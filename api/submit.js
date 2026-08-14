const { google } = require('googleapis');

module.exports = async (req, res) => {
  // Set CORS headers for Vercel
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed. Only POST is accepted.' });
  }

  try {
    const { studentName, department, attendance } = req.body || {};

    // 1. Server-Side Validation
    if (!studentName || !studentName.trim()) {
      return res.status(400).json({ success: false, error: 'Student name is required.' });
    }
    if (!department || !department.trim()) {
      return res.status(400).json({ success: false, error: 'Department selection is required.' });
    }
    if (!attendance || !attendance.trim()) {
      return res.status(400).json({ success: false, error: 'Onam attendance selection is required.' });
    }

    // 2. Generate IST Timestamp (YYYY-MM-DD HH:mm:ss)
    const now = new Date();
    const istTimeStr = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(now);

    const cleanName = studentName.trim();
    const cleanDept = department.trim();
    const cleanAttendance = attendance.trim();

    // 3. Option A: Using Google Sheets Service Account API
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKeyRaw = process.env.GOOGLE_PRIVATE_KEY;
    const sheetId = process.env.GOOGLE_SHEET_ID;

    if (serviceAccountEmail && privateKeyRaw && sheetId) {
      const privateKey = privateKeyRaw.replace(/\\n/g, '\n');

      const auth = new google.auth.JWT({
        email: serviceAccountEmail,
        key: privateKey,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });

      const sheets = google.sheets({ version: 'v4', auth });

      // Append row below existing entries (Column A to D: Timestamp | Student Name | Department | Onam Attendance)
      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: 'Sheet1!A:D',
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: [
            [istTimeStr, cleanName, cleanDept, cleanAttendance]
          ]
        }
      });

      return res.status(200).json({
        success: true,
        message: 'Registration recorded successfully in Google Sheets.'
      });
    }

    // 3. Google Apps Script Web App URL (sends URLSearchParams as required by Apps Script e.parameter)
    const webhookUrl = process.env.GOOGLE_WEBHOOK_URL || 'https://script.google.com/macros/s/AKfycby-shUzKa85Dn5vFJ_Ln_F2XzR9S9tKr11sduoLVjh_8hnLZj8MTEkRFy5Dx61BYbir/exec';
    
    if (webhookUrl && webhookUrl.startsWith('http')) {
      const formData = new URLSearchParams();
      formData.append('studentName', cleanName);
      formData.append('department', cleanDept);
      formData.append('attendance', cleanAttendance);

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
        redirect: 'follow'
      });

      const responseText = await response.text();
      let responseJson = {};
      try {
        responseJson = JSON.parse(responseText);
      } catch (e) {}

      if (response.ok || responseJson.success) {
        return res.status(200).json({
          success: true,
          message: 'Registration recorded successfully in Google Sheets.',
          data: responseJson
        });
      } else {
        throw new Error(`Google Apps Script failed: ${responseText}`);
      }
    }

    // If no credentials configured yet, return clear helpful message for administrator
    console.warn('Google Sheets environment variables not yet configured in Vercel.');
    return res.status(500).json({
      success: false,
      error: 'Google Sheets integration not configured. Please set GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, and GOOGLE_SHEET_ID (or GOOGLE_WEBHOOK_URL) in Vercel.'
    });

  } catch (error) {
    console.error('Submission API Error:', error);
    return res.status(500).json({
      success: false,
      error: 'An internal error occurred while recording the submission. Please try again.'
    });
  }
};
