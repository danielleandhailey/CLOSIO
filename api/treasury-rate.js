export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // Alpha Vantage - free, reliable
    const avRes = await fetch(
      'https://www.alphavantage.co/query?function=TREASURY_YIELD&interval=daily&maturity=10year&apikey=demo'
    );
    const avData = await avRes.json();
    const avRate = avData?.data?.[0]?.value;
    if (avRate && avRate !== '.') {
      return res.status(200).json({ rate: parseFloat(avRate).toFixed(3), success: true, source: 'alphavantage' });
    }

    // Twelve Data API (usually works)
    const apiKey = '36b46313317e454b8f57f99323653c2f';
    const response = await fetch(
      `https://api.twelvedata.com/price?symbol=TNX&apikey=${apiKey}`
    );
    const data = await response.json();

    if (data.price) {
      return res.status(200).json({ rate: parseFloat(data.price).toFixed(3), success: true, source: 'twelvedata' });
    }

    // FRED (prior day close - always works)
    const fredKey = '0e8dd4ee7d6651eaff6e8a9817d768fb';
    const fredRes = await fetch(
      `https://api.stlouisfed.org/fred/series/observations?series_id=DGS10&api_key=${fredKey}&file_type=json&sort_order=desc&limit=1`
    );
    const fredData = await fredRes.json();
    if (fredData.observations && fredData.observations.length > 0 && fredData.observations[0].value !== '.') {
      return res.status(200).json({ rate: parseFloat(fredData.observations[0].value).toFixed(3), success: true, source: 'fred' });
    }

    return res.status(200).json({ rate: '4.500', success: false });
  } catch (e) {
    return res.status(500).json({ error: e.message, rate: '4.500' });
  }
}
