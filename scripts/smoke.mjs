import YahooFinance from "yahoo-finance2";
const yf = new YahooFinance();

const q = await yf.quote("AAPL");
console.log("AAPL quote:", { price: q.regularMarketPrice, name: q.longName, currency: q.currency });

const s = await yf.quoteSummary("AAPL", { modules: ["summaryDetail", "financialData", "defaultKeyStatistics"] });
console.log("PE:", s.summaryDetail?.trailingPE, "margin:", s.financialData?.profitMargins);

const c = await yf.chart("AAPL", { period1: new Date(Date.now() - 7 * 86400e3), period2: new Date(), interval: "1d" });
console.log("chart rows:", c.quotes.length, "last close:", c.quotes.at(-1)?.close);

const n = await yf.search("AAPL", { newsCount: 3, quotesCount: 0 });
console.log("news:", n.news?.length, "first:", n.news?.[0]?.title);
