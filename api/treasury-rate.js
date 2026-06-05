export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const apiKey = '0e8dd4ee7d6651eaff6e8a9817d768fb';
    const response = await fetch(
      `https://api.stlouisfed.org/fred/series/observations?series_id=DGS10&api_key=${apiKey}&file_type=json&sort_order=desc&limit=1`
    );
    const data = await response.json();

    if (data.observations && data.observations.length > 0) {
      const rate = data.observations[0].value;
      const date = data.observations[0].date;
      return res.status(200).json({ rate, date, success: true });
    }

    return res.status(200).json({ rate: '4.28', date: null, success: false });
  } catch (e) {
    return res.status(500).json({ error: e.message, rate: '4.28' });
  }
}
