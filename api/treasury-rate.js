export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // Twelve Data API - real-time
    const apiKey = '36b46313317e454b8f57f99323653c2f';
    const response = await fetch(
      `https://api.twelvedata.com/price?symbol=TNX&apikey=${apiKey}`
    );
    const data = await response.json();

    if (data.price) {
      return res.status(200).json({ rate: data.price, success: true });
    }

    // Fallback to FRED if Twelve Data fails
    const fredKey = '0e8dd4ee7d6651eaff6e8a9817d768fb';
    const fredRes = await fetch(
      `https://api.stlouisfed.org/fred/series/observations?series_id=DGS10&api_key=${fredKey}&file_type=json&sort_order=desc&limit=1`
    );
    const fredData = await fredRes.json();
    if (fredData.observations && fredData.observations.length > 0) {
      return res.status(200).json({ rate: fredData.observations[0].value, success: true, source: 'fred' });
    }

    return res.status(200).json({ rate: '4.50', success: false });
  } catch (e) {
    return res.status(500).json({ error: e.message, rate: '4.50' });
  }
}
