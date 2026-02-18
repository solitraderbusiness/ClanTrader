import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import type { StatementMetrics } from "@/types/statement";

export class StatementParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StatementParseError";
  }
}

function parseNumber(text: string): number {
  // Remove spaces, currency symbols, and parse
  const cleaned = text.replace(/[\s$€£¥]/g, "").replace(/,/g, "");
  const num = parseFloat(cleaned);
  if (isNaN(num)) return 0;
  return num;
}

function extractPairs(rows: cheerio.Cheerio<AnyNode>, $: cheerio.CheerioAPI): string[] {
  const pairs = new Set<string>();
  const pairPattern = /^[A-Z]{6}(?:\.[a-z]+)?$/;

  rows.each((_, row) => {
    const cells = $(row).find("td");
    cells.each((__, cell) => {
      const text = $(cell).text().trim();
      if (pairPattern.test(text)) {
        // Normalize: take first 6 chars (EURUSD from EURUSD.pro)
        pairs.add(text.slice(0, 6));
      }
    });
  });

  return Array.from(pairs).sort();
}

function detectFormat($: cheerio.CheerioAPI): "MT4" | "MT5" | null {
  const title = $("title").text().toLowerCase();
  const body = $("body").text();

  // MT4: title contains "strategy tester" or has specific table structures
  if (title.includes("strategy tester report") || title.includes("statement")) {
    // MT4 statements have "Summary" as a table header
    if ($("td:contains('Summary')").length > 0 || $("td:contains('Closed Transactions')").length > 0) {
      return "MT4";
    }
  }

  // MT5: has "Deals" and "Positions" sections, or "Trading Report" title
  if (
    body.includes("Deals") &&
    (body.includes("Positions") || body.includes("Orders"))
  ) {
    // Check for MT5-specific elements
    if ($("td:contains('Deals')").length > 0 || title.includes("trading report")) {
      return "MT5";
    }
  }

  // MT4 fallback: look for common MT4 patterns
  if (
    $("td:contains('Gross Profit')").length > 0 &&
    $("td:contains('Gross Loss')").length > 0
  ) {
    return "MT4";
  }

  // MT5 fallback
  if ($("td:contains('Profit:')").length > 0 && $("td:contains('Balance:')").length > 0) {
    return "MT5";
  }

  return null;
}

function findCellValue($: cheerio.CheerioAPI, label: string): string {
  // Find a td containing the label, then get the next td's text
  let value = "";
  $("td").each((_, el) => {
    const text = $(el).text().trim();
    if (text.toLowerCase().includes(label.toLowerCase())) {
      const next = $(el).next("td");
      if (next.length > 0) {
        value = next.text().trim();
        return false; // break
      }
    }
  });
  return value;
}

function parseMT4($: cheerio.CheerioAPI): StatementMetrics {
  // Extract summary metrics
  const totalNetProfit = parseNumber(findCellValue($, "Total Net Profit"));
  const grossProfit = parseNumber(findCellValue($, "Gross Profit"));
  const grossLoss = parseNumber(findCellValue($, "Gross Loss"));
  const profitFactor = parseNumber(findCellValue($, "Profit Factor"));
  const totalTrades = parseNumber(findCellValue($, "Total Trades"));

  // Drawdown
  let maxDrawdown = 0;
  let maxDrawdownPercent = 0;
  const drawdownText = findCellValue($, "Maximal Drawdown");
  if (drawdownText) {
    maxDrawdown = parseNumber(drawdownText.split("(")[0]);
    const percentMatch = drawdownText.match(/\(([\d.]+)%\)/);
    if (percentMatch) {
      maxDrawdownPercent = parseFloat(percentMatch[1]);
    }
  }

  // Win rate: find from "Profit Trades (% of total)"
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

  // Trading period: extract dates from first and last trade rows
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

  // Extract pairs from trade rows
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
  // MT5 has a different structure - look for key:value patterns
  const profit = parseNumber(findCellValue($, "Profit:") || findCellValue($, "Total Profit:"));
  const loss = Math.abs(parseNumber(findCellValue($, "Loss:") || findCellValue($, "Total Loss:")));
  const totalNetProfit = parseNumber(findCellValue($, "Total Net Profit:") || String(profit - loss));
  const grossProfit = profit || 0;
  const grossLoss = loss || 0;

  // If we didn't find explicit net profit, compute it
  const netProfit = totalNetProfit || grossProfit - grossLoss;

  const profitFactor = parseNumber(findCellValue($, "Profit Factor:"));
  const totalTradesText = findCellValue($, "Total Trades:") || findCellValue($, "Trades Total:");
  const totalTrades = parseNumber(totalTradesText);

  // Drawdown
  let maxDrawdown = 0;
  let maxDrawdownPercent = 0;
  const balanceDrawdownText = findCellValue($, "Balance Drawdown Maximal:") ||
    findCellValue($, "Maximal Drawdown:");
  if (balanceDrawdownText) {
    maxDrawdown = parseNumber(balanceDrawdownText.split("(")[0]);
    const percentMatch = balanceDrawdownText.match(/([\d.]+)%/);
    if (percentMatch) {
      maxDrawdownPercent = parseFloat(percentMatch[1]);
    }
  }

  // Win rate
  let winRate = 0;
  const winRateText = findCellValue($, "Profit Trades:");
  if (winRateText) {
    const percentMatch = winRateText.match(/([\d.]+)%/);
    if (percentMatch) {
      winRate = parseFloat(percentMatch[1]);
    }
  }

  // Sharpe ratio (MT5 sometimes includes this)
  const sharpeText = findCellValue($, "Sharpe Ratio:");
  const sharpeRatio = sharpeText ? parseNumber(sharpeText) : null;

  // Trading period from deals/positions rows
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
    sharpeRatio,
  };
}

export function parseStatement(html: string): StatementMetrics {
  const $ = cheerio.load(html);

  const format = detectFormat($);
  if (!format) {
    throw new StatementParseError(
      "Could not detect statement format. Please upload an MT4 or MT5 HTML statement."
    );
  }

  const metrics = format === "MT4" ? parseMT4($) : parseMT5($);

  // Basic validation: must have some meaningful data
  if (metrics.totalTrades === 0 && metrics.totalNetProfit === 0) {
    throw new StatementParseError(
      "Could not extract trading data from this statement. Please ensure this is a valid MT4/MT5 HTML report."
    );
  }

  return metrics;
}
