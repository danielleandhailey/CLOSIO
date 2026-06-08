export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // MarketWatch widget API - matches CNBC closely
    const mwRes = await fetch(
      'https://api.wsj.net/api/dylan/quotes/v2/comp/quote?id=BX:TMUBMUSD10Y&accept=application/json'
    );
    const mwData = await mwRes.json();
    const mwRate = mwData?.data?.[0]?.last;
    if (mwRate) {
      return res.status(200).json({ rate: parseFloat(mwRate).toFixed(3), success: true, source: 'wsj' });
    }

    // Fallback: Tradingview-style endpoint
    const tvRes = await fetch(
      'https://scanner.tradingview.com/bond/scan',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbols: { tickers: ['TVC:US10Y'] },
          columns: ['close']
        })
      }
    );
    const tvData = await tvRes.json();
    const tvRate = tvData?.data?.[0]?.d?.[0];
    if (tvRate) {
      return res.status(200).json({ rate: parseFloat(tvRate).toFixed(3), success: true, source: 'tradingview' });
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

    // Final fallback: FRED (prior day close)
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
