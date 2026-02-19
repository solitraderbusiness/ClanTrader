import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import type { StatementMetrics } from "@/types/statement";

export class StatementParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StatementParseError";
  }
}

/**
 * Detect and convert UTF-16 encoded HTML to UTF-8.
 * MT5 exports from some brokers use UTF-16LE encoding.
 */
function normalizeEncoding(buffer: Buffer): string {
  // Check for UTF-16 LE BOM (FF FE) or null bytes pattern
  if (
    (buffer[0] === 0xff && buffer[1] === 0xfe) ||
    (buffer.length > 3 && buffer[1] === 0x00 && buffer[3] === 0x00)
  ) {
    return buffer.toString("utf16le");
  }
  // Check for UTF-16 BE BOM (FE FF)
  if (buffer[0] === 0xfe && buffer[1] === 0xff) {
    // Swap bytes for BE, then decode as LE
    const swapped = Buffer.alloc(buffer.length);
    for (let i = 0; i < buffer.length - 1; i += 2) {
      swapped[i] = buffer[i + 1];
      swapped[i + 1] = buffer[i];
    }
    return swapped.toString("utf16le");
  }
  return buffer.toString("utf-8");
}

function parseNumber(text: string): number {
  // Remove spaces, non-breaking spaces, currency symbols, and parse
  const cleaned = text.replace(/[\s\u00a0$€£¥]/g, "").replace(/,/g, "");
  const num = parseFloat(cleaned);
  if (isNaN(num)) return 0;
  return num;
}

function extractPairs(rows: cheerio.Cheerio<AnyNode>, $: cheerio.CheerioAPI): string[] {
  const pairs = new Set<string>();
  // Match pairs like EURUSD, GBPUSD_l, BTCUSD_l, XAUUSD.pro, etc.
  const pairPattern = /^[A-Z]{6}(?:[._][a-zA-Z]+)?$/;

  rows.each((_, row) => {
    const cells = $(row).find("td");
    cells.each((__, cell) => {
      const text = $(cell).text().trim();
      if (pairPattern.test(text)) {
        // Normalize: take first 6 chars (EURUSD from EURUSD_l or EURUSD.pro)
        pairs.add(text.slice(0, 6));
      }
    });
  });

  return Array.from(pairs).sort();
}

function detectFormat($: cheerio.CheerioAPI): "MT4" | "MT5" | null {
  const title = $("title").text().toLowerCase();
  const bodyText = $("body").text().toLowerCase();

  // MT5: "Trade History Report" or "Trading Report" in title
  if (title.includes("trade history report") || title.includes("trading report")) {
    return "MT5";
  }

  // MT5: has "Positions" header and summary fields like "Total Net Profit:"
  if (bodyText.includes("positions") && bodyText.includes("total net profit:")) {
    return "MT5";
  }

  // MT4: title contains "strategy tester report" or "statement"
  if (title.includes("strategy tester report") || title.includes("statement")) {
    if (bodyText.includes("summary") || bodyText.includes("closed transactions")) {
      return "MT4";
    }
  }

  // MT4 fallback: look for MT4-specific labels (no colon)
  if (bodyText.includes("gross profit") && bodyText.includes("gross loss") && bodyText.includes("total net profit")) {
    // Distinguish: MT5 uses "Total Net Profit:" with colon, MT4 without
    if (bodyText.includes("closed transactions") || bodyText.includes("summary")) {
      return "MT4";
    }
    // If it has "Positions" section header, it's MT5
    if (bodyText.includes("positions")) {
      return "MT5";
    }
    // Default to MT5 for modern reports with these fields
    return "MT5";
  }

  // MT4 last resort
  if (bodyText.includes("gross profit") && bodyText.includes("profit factor")) {
    return "MT4";
  }

  return null;
}

/**
 * Find a value in the same row as a label cell.
 * Works for both adjacent-td and colspan layouts.
 */
function findCellValue($: cheerio.CheerioAPI, label: string): string {
  let value = "";
  const labelLower = label.toLowerCase();

  $("td").each((_, el) => {
    const text = $(el).text().trim();
    if (text.toLowerCase() === labelLower || text.toLowerCase().startsWith(labelLower)) {
      // Strategy 1: next sibling td
      const next = $(el).next("td");
      if (next.length > 0 && next.text().trim()) {
        value = next.text().trim();
        return false;
      }

      // Strategy 2: search remaining tds in the same row
      const row = $(el).closest("tr");
      const cells = row.find("td");
      let foundLabel = false;
      cells.each((__, cell) => {
        if (foundLabel) {
          const cellText = $(cell).text().trim();
          if (cellText) {
            value = cellText;
            return false;
          }
        }
        if ($(cell).is($(el))) {
          foundLabel = true;
        }
      });

      if (value) return false;
    }
  });

  // Also check <th> elements (some MT5 reports use th for labels)
  if (!value) {
    $("th").each((_, el) => {
      const text = $(el).text().trim();
      if (text.toLowerCase() === labelLower || text.toLowerCase().startsWith(labelLower)) {
        const next = $(el).next("td, th");
        if (next.length > 0 && next.text().trim()) {
          value = next.text().trim();
          return false;
        }
      }
    });
  }

  return value;
}

function parseMT4($: cheerio.CheerioAPI): StatementMetrics {
  const totalNetProfit = parseNumber(findCellValue($, "Total Net Profit"));
  const grossProfit = parseNumber(findCellValue($, "Gross Profit"));
  const grossLoss = parseNumber(findCellValue($, "Gross Loss"));
  const profitFactor = parseNumber(findCellValue($, "Profit Factor"));
  const totalTrades = parseNumber(findCellValue($, "Total Trades"));

  let maxDrawdown = 0;
  let maxDrawdownPercent = 0;
  const drawdownText = findCellValue($, "Maximal Drawdown");
  if (drawdownText) {
    maxDrawdown = parseNumber(drawdownText.split("(")[0]);
    const percentMatch = drawdownText.match(/([\d.]+)%/);
    if (percentMatch) {
      maxDrawdownPercent = parseFloat(percentMatch[1]);
    }
  }

  let winRate = 0;
  const profitTradesText = findCellValue($, "Profit Trades");
  if (profitTradesText) {
    const percentMatch = profitTradesText.match(/([\d.]+)%/);
    if (percentMatch) {
      winRate = parseFloat(percentMatch[1]);
    } else if (totalTrades > 0) {
      const profitCount = parseNumber(profitTradesText);
      winRate = (profitCount / totalTrades) * 100;
    }
  }

  const tradeRows = $("tr").filter((_, el) => {
    const firstTd = $(el).find("td").first().text().trim();
    return /^\d{4}\.\d{2}\.\d{2}/.test(firstTd);
  });

  let tradingPeriodStart = "";
  let tradingPeriodEnd = "";
  if (tradeRows.length > 0) {
    tradingPeriodStart = $(tradeRows.first()).find("td").first().text().trim().split(" ")[0];
    tradingPeriodEnd = $(tradeRows.last()).find("td").first().text().trim().split(" ")[0];
  }

  const pairsTraded = extractPairs(tradeRows, $);

  return {
    totalNetProfit,
    grossProfit,
    grossLoss,
    profitFactor,
    totalTrades,
    winRate: Math.round(winRate * 100) / 100,
    maxDrawdown,
    maxDrawdownPercent: Math.round(maxDrawdownPercent * 100) / 100,
    tradingPeriodStart,
    tradingPeriodEnd,
    pairsTraded,
    sharpeRatio: null,
  };
}

function parseMT5($: cheerio.CheerioAPI): StatementMetrics {
  const totalNetProfit = parseNumber(findCellValue($, "Total Net Profit:"));
  const grossProfit = parseNumber(findCellValue($, "Gross Profit:"));
  const grossLoss = parseNumber(findCellValue($, "Gross Loss:"));

  // Fallback: if explicit gross values missing, try generic Profit/Loss
  const gp = grossProfit || parseNumber(findCellValue($, "Profit:") || findCellValue($, "Total Profit:"));
  const gl = grossLoss || Math.abs(parseNumber(findCellValue($, "Loss:") || findCellValue($, "Total Loss:")));
  const netProfit = totalNetProfit || gp - gl;

  const profitFactor = parseNumber(findCellValue($, "Profit Factor:"));
  const totalTrades = parseNumber(
    findCellValue($, "Total Trades:") || findCellValue($, "Trades Total:")
  );

  let maxDrawdown = 0;
  let maxDrawdownPercent = 0;
  const balanceDrawdownText =
    findCellValue($, "Balance Drawdown Maximal:") ||
    findCellValue($, "Maximal Drawdown:");
  if (balanceDrawdownText) {
    maxDrawdown = parseNumber(balanceDrawdownText.split("(")[0]);
    const percentMatch = balanceDrawdownText.match(/([\d.]+)%/);
    if (percentMatch) {
      maxDrawdownPercent = parseFloat(percentMatch[1]);
    }
  }

  let winRate = 0;
  const winRateText =
    findCellValue($, "Profit Trades (% of total):") ||
    findCellValue($, "Profit Trades:");
  if (winRateText) {
    const percentMatch = winRateText.match(/([\d.]+)%/);
    if (percentMatch) {
      winRate = parseFloat(percentMatch[1]);
    }
  }

  const sharpeText = findCellValue($, "Sharpe Ratio:");
  const sharpeRatio = sharpeText ? parseNumber(sharpeText) : null;

  const tradeRows = $("tr").filter((_, el) => {
    const firstTd = $(el).find("td").first().text().trim();
    return /^\d{4}\.\d{2}\.\d{2}/.test(firstTd);
  });

  let tradingPeriodStart = "";
  let tradingPeriodEnd = "";
  if (tradeRows.length > 0) {
    tradingPeriodStart = $(tradeRows.first()).find("td").first().text().trim().split(" ")[0];
    tradingPeriodEnd = $(tradeRows.last()).find("td").first().text().trim().split(" ")[0];
  }

  const pairsTraded = extractPairs(tradeRows, $);

  return {
    totalNetProfit: netProfit,
    grossProfit: gp,
    grossLoss: gl,
    profitFactor,
    totalTrades,
    winRate: Math.round(winRate * 100) / 100,
    maxDrawdown,
    maxDrawdownPercent: Math.round(maxDrawdownPercent * 100) / 100,
    tradingPeriodStart,
    tradingPeriodEnd,
    pairsTraded,
    sharpeRatio,
  };
}

export function parseStatement(htmlOrBuffer: string | Buffer): StatementMetrics {
  // Handle encoding: convert UTF-16 to UTF-8 if needed
  const html =
    typeof htmlOrBuffer === "string"
      ? htmlOrBuffer
      : normalizeEncoding(htmlOrBuffer);

  const $ = cheerio.load(html);

  const format = detectFormat($);
  if (!format) {
    throw new StatementParseError(
      "Could not detect statement format. Please upload an MT4 or MT5 HTML statement."
    );
  }

  const metrics = format === "MT4" ? parseMT4($) : parseMT5($);

  if (metrics.totalTrades === 0 && metrics.totalNetProfit === 0) {
    throw new StatementParseError(
      "Could not extract trading data from this statement. Please ensure this is a valid MT4/MT5 HTML report."
    );
  }

  return metrics;
}
