import { Plugin, TFile } from 'obsidian';

export default class VocabLinkerPlugin extends Plugin {
	async onload() {
		console.log('Vocab Linker Loaded');

		// 監聽檔案打開事件：只在打開檔案時處理一次
		this.registerEvent(
			this.app.workspace.on('file-open', (file) => {
				console.log('file-open, start making auto links');
				this.processActiveFile(file);
			})
		);
	}

	// 主處理邏輯
	processActiveFile = async (file: TFile | null) => {
		if (!file) return;

		const content = await this.app.vault.read(file);

		// 只有當檔案裡有 "---" 分隔線才處理，避免誤傷其他筆記
		if (!content.includes('\n---\n')) return;

		const newContent = this.generateLinks(content);

		// 如果內容沒有變化，就不寫入 (節省 I/O)
		if (newContent !== content) {
			await this.app.vault.modify(file, newContent);
			console.log('Vocab links updated!');
		}
	}

	generateLinks(content: string): string {
		// Helper: 產生隨機 ID (6位 hex)
		const genId = () => '^' + Math.random().toString(16).substring(2, 8);

		const parts = content.split('\n---\n');
		if (parts.length < 2) return content;

		let vocabSection = parts[0].split('\n');
		let sentenceSection = parts[1].split('\n');

		// 1. 建立單字 Map
		let vocabMap: Record<string, { id: string, otherLinks: string, originalCase: string }> = {};
		
		// 用來收集所有關鍵字，準備做成 Master Regex
		let allKeywords: string[] = [];

		vocabSection = vocabSection.map((line) => {
			if (!line.trim()) return line;

			// Regex: 抓取單字、其他連結、剩餘 ID
			const match = line.match(/^([a-zA-Z\-]+)\s*(\[(?!s\d+).*?\]\(.*?\))?\s*(.*)$/);

			if (match) {
				const word = match[1].trim();
				const otherLinks = match[2] || "";
				const restOfLine = match[3] || "";
				
				let id = restOfLine.match(/\^[a-z0-9]{6}(?!\))/)?.[0];
				if (!id) id = genId();

				const wordLower = word.toLowerCase();
				vocabMap[wordLower] = {
					id: id.trim(),
					otherLinks: otherLinks.trim(),
					originalCase: word // 保存原始大小寫以便 Regex 排序
				};
				
				allKeywords.push(wordLower);
				return line; 
			}
			return line;
		});

		// --- 優化重點 1: 建立 Master Regex ---
		// 先按長度排序(長在前)，避免 "enable" 匹配到 "enablement" 的前綴
		allKeywords.sort((a, b) => b.length - a.length);
		
		// 跳脫特殊字元 (Escape Regex)
		const escapedKeywords = allKeywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
		
		// 建立單一的大正則表達式： (?<!\[)(?<!\w)(word1|word2|...)\w*(?!\])
		// 意思：關鍵字必須是單詞的開頭（或完整單詞），且不在連結內
		// - (?<!\w) 確保前面不是單詞字符（即關鍵字是單詞的開頭）
		// - \w* 允許關鍵字後面有更多字母（如 connect -> connectivity, connected）
		// - reconnect 中的 connect 不會匹配，因為前面有 'r'
		const masterRegex = allKeywords.length > 0 
			? new RegExp(`(?<!\\[)(?<!\\w)(${escapedKeywords.join('|')})\\w*(?!\\])`, 'gi')
			: null;

		// 2. 掃描例句 (只需一次遍歷)
		const keywordToSentences: Record<string, Set<string>> = {}; // 使用 Set 避免同句重複記錄 ID

		sentenceSection = sentenceSection.map((line) => {
			if (!line.trim()) return line;

			let newLine = line;
			let sentenceId = line.match(/\s+(\^[a-z0-9]{6})\s*$/)?.[1];
			if (!sentenceId) sentenceId = genId();
			
			let lineHasMatch = false;

			// 先處理已經存在的連結：更新連結中的 ID
			const existingLinks = newLine.match(/\[([^\]]+)\]\(#(\^[a-z0-9]{6})\)/g);
			if (existingLinks) {
				for (const link of existingLinks) {
					const linkMatch = link.match(/\[([^\]]+)\]\(#(\^[a-z0-9]{6})\)/);
					if (linkMatch) {
						const linkedWord = linkMatch[1].toLowerCase();
						const linkedId = linkMatch[2];

						// 檢查 vocabMap 中是否有這個單字
						if (vocabMap[linkedWord]) {
							const vData = vocabMap[linkedWord];

							// 如果 ID 不匹配，更新連結中的 ID 為 vocabMap 中的 ID
							if (vData.id !== linkedId) {
								newLine = newLine.replace(
									`[${linkMatch[1]}](#${linkedId})`,
									`[${linkMatch[1]}](#${vData.id})`
								);
							}

							// 記錄這個單字出現在這個句子中
							if (!keywordToSentences[linkedWord]) {
								keywordToSentences[linkedWord] = new Set();
							}
							keywordToSentences[linkedWord].add(sentenceId);
							lineHasMatch = true;
						}
					}
				}
			}

			// --- 優化重點 2: 使用 Master Regex 進行一次性替換 ---
			if (masterRegex) {
				newLine = newLine.replace(masterRegex, (match) => {
					// match 可能是整個單詞（如 "connectivity"），需要找到實際匹配的關鍵字
					const lowerMatch = match.toLowerCase();
					
					// 從最長到最短查找匹配的關鍵字
					let matchedKeyword: string | null = null;
					for (const keyword of allKeywords) {
						if (lowerMatch.startsWith(keyword)) {
							matchedKeyword = keyword;
							break;
						}
					}
					
					if (matchedKeyword && vocabMap[matchedKeyword]) {
						const vData = vocabMap[matchedKeyword];
						lineHasMatch = true;
						
						// 記錄: 這個單字用到了這個 sentenceId
						if (!keywordToSentences[matchedKeyword]) {
							keywordToSentences[matchedKeyword] = new Set();
						}
						keywordToSentences[matchedKeyword].add(sentenceId);

						// 只替換關鍵字部分為連結，保留後綴
						// 例如: "connectivity" -> "[connect](#id)ivity"
						const suffix = match.substring(matchedKeyword.length);
						const keywordCase = match.substring(0, matchedKeyword.length); // 保留原始大小寫
						return `[${keywordCase}](#${vData.id})${suffix}`;
					}
					return match;
				});
			}

			if (lineHasMatch && !newLine.includes(sentenceId)) {
				newLine = `${newLine} ${sentenceId}`;
			}

			return newLine;
		});

		// 3. 產生 sN 連結 (跟之前一樣，但資料結構變簡單了)
		const vocabLinkText: Record<string, string> = {};
		for (const wordKey in keywordToSentences) {
			// Set 轉 Array
			const sentenceIds = Array.from(keywordToSentences[wordKey]);
			const links = sentenceIds.map((sid, index) => `[s${index + 1}](#${sid})`);
			vocabLinkText[wordKey] = links.join(' ');
		}

		// 4. 更新單字區 (O(M) 簡單字串操作)
		vocabSection = vocabSection.map(line => {
			// 快速檢查：這行是不是我們認識的單字行
			const match = line.match(/^([a-zA-Z\-]+)/);
			if (match) {
				const wordKey = match[1].toLowerCase();
				const vData = vocabMap[wordKey];
				
				if (vData) {
					const otherLinksPart = vData.otherLinks ? `  ${vData.otherLinks}` : "";
					const linkPart = vocabLinkText[wordKey] ? ` ${vocabLinkText[wordKey]}` : "";
					
					// 這裡不需要用 Regex 重組，直接用原始行的單字部分開頭即可
					const originalWord = line.split(/[ \[\^]/)[0].trim();
					return `${originalWord}${otherLinksPart}${linkPart} ${vData.id}`;
				}
			}
			return line;
		});

		// 5. 確保有 ID 的行的上下行都是空的（讓 ID 可以被正常搜尋）
		vocabSection = this.ensureEmptyLinesAroundIds(vocabSection);
		sentenceSection = this.ensureEmptyLinesAroundIds(sentenceSection);

		return vocabSection.join('\n') + '\n---\n' + sentenceSection.join('\n');
	}

	// 確保有 ID 的行的上下行都是空的，讓 ID 可以被正常搜尋
	ensureEmptyLinesAroundIds(lines: string[]): string[] {
		const result: string[] = [];
		const idPattern = /\^[a-z0-9]{6}/;

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const hasId = idPattern.test(line);
			const prevLine = i > 0 ? lines[i - 1] : null;
			const nextLine = i < lines.length - 1 ? lines[i + 1] : null;

			// 如果這行有 ID，確保上下行都是空的
			if (hasId) {
				// 檢查上一行是否為空
				const prevIsEmpty = prevLine ? prevLine.trim() === '' : true;
				// 檢查結果中最後一行是否為空
				const lastResultLine = result.length > 0 ? result[result.length - 1] : null;
				const lastResultIsEmpty = lastResultLine ? lastResultLine.trim() === '' : true;
				
				// 如果上一行不是空的，且結果中最後一行也不是空的，插入空行
				if (!prevIsEmpty && !lastResultIsEmpty) {
					result.push('');
				}

				// 添加當前行
				result.push(line);

				// 檢查下一行是否為空
				const nextIsEmpty = nextLine ? nextLine.trim() === '' : true;
				
				// 如果下一行不是空的，插入空行
				if (!nextIsEmpty) {
					result.push('');
				}
			} else {
				// 如果這行沒有 ID，直接添加
				result.push(line);
			}
		}

		return result;
	}
}

