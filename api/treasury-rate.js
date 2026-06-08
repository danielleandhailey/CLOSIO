export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // Try Yahoo Finance API (real-time, reliable)
    const yahooRes = await fetch(
      'https://query1.finance.yahoo.com/v8/finance/chart/%5ETNX?interval=1m&range=1d'
    );
    const yahooData = await yahooRes.json();
    const yahooRate = yahooData?.chart?.result?.[0]?.meta?.regularMarketPrice;
    if (yahooRate) {
      return res.status(200).json({ rate: yahooRate.toFixed(3), success: true, source: 'yahoo' });
    }

    // Fallback: CNBC quote API
    const cnbcRes = await fetch(
      'https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol?symbols=US10Y&requestMethod=itv&noCache=' + Date.now()
    );
    const cnbcData = await cnbcRes.json();
    const cnbcRate = cnbcData?.FormattedQuoteResult?.FormattedQuote?.[0]?.last;
    if (cnbcRate) {
      return res.status(200).json({ rate: parseFloat(cnbcRate).toFixed(3), success: true, source: 'cnbc' });
    }

    // Fallback: Twelve Data API
    const apiKey = '36b46313317e454b8f57f99323653c2f';
    const response = await fetch(
      `https://api.twelvedata.com/price?symbol=TNX&apikey=${apiKey}`
    );
    const data = await response.json();

    if (data.price) {
      return res.status(200).json({ rate: parseFloat(data.price).toFixed(3), success: true, source: 'twelvedata' });
    }

    // Fallback: FRED (prior day close)
    const fredKey = '0e8dd4ee7d6651eaff6e8a9817d768fb';
    const fredRes = await fetch(
      `https://api.stlouisfed.org/fred/series/observations?series_id=DGS10&api_key=${fredKey}&file_type=json&sort_order=desc&limit=1`
    );
    const fredData = await fredRes.json();
    if (fredData.observations && fredData.observations.length > 0) {
      return res.status(200).json({ rate: parseFloat(fredData.observations[0].value).toFixed(3), success: true, source: 'fred' });
    }

    return res.status(200).json({ rate: '4.500', success: false });
  } catch (e) {
    return res.status(500).json({ error: e.message, rate: '4.500' });
  }
}
