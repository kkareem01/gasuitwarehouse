# Google Sheets webhook — one-time setup

The in-store intake form (`/intake/`) saves every customer to the LibSQL database.
That database is the source of truth. As a convenience, each new submission is
also mirrored into a Google Sheet so staff can browse, sort, and filter the data
like they would in Excel.

This page walks through wiring up that Sheet. Takes about 5 minutes.

## 1. Create the Sheet

1. Go to <https://sheets.new> (signed into the GA Suit Warehouse Google account).
2. Rename the file to **GA Suit Intakes**.
3. Paste this header row into row 1, in order:

```
Submitted At	Intake ID	First Name	Last Name	Phone	Email	Suit Size	Suit Color	Tailoring Notes	Need-By Date
```

(Tabs separate columns — copy/paste should put each in its own cell.)

## 2. Add the Apps Script

1. In the Sheet, choose **Extensions → Apps Script**.
2. Delete any boilerplate, then paste:

```javascript
const SHEET_NAME = 'Sheet1'; // change if you renamed the tab

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error('Sheet "' + SHEET_NAME + '" not found');
    sheet.appendRow([
      data.createdAt || new Date().toISOString(),
      data.id || '',
      data.firstName || '',
      data.lastName || '',
      data.phone || '',
      data.email || '',
      data.suitSize || '',
      data.suitColor || '',
      data.tailoringNotes || '',
      data.needByDate || '',
    ]);
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

3. Click the disk icon to save. Name the project anything (e.g. "intake-mirror").

## 3. Deploy as a Web App

1. Click **Deploy → New deployment**.
2. Click the gear icon → choose **Web app**.
3. Settings:
   - **Description**: "intake mirror"
   - **Execute as**: *Me (your-account@gmail.com)*
   - **Who has access**: **Anyone**
4. Click **Deploy**. Approve the permissions prompt the first time.
5. Copy the **Web app URL** that appears (it ends in `/exec`).

> The "Anyone" permission is fine here because the URL itself is the secret —
> anyone who has it can append rows, but no one without it can read or write
> the Sheet. Keep the URL out of public places (don't paste it in code that
> ships to the browser, in screenshots, etc).

## 4. Add the URL to Vercel

1. In the Vercel dashboard, go to the project → **Settings → Environment Variables**.
2. Add a new variable:
   - **Name**: `SHEETS_WEBHOOK_URL`
   - **Value**: the `/exec` URL you copied
   - **Environments**: Production, Preview, Development (check all three)
3. Save. Trigger a redeploy (push any commit, or **Deployments → ⋯ → Redeploy**).

## 5. Test it

1. Visit `https://www.gasuitwarehouse.com/intake/` on the iPad (or any browser).
2. Fill in a test customer (e.g. "Test Test, 5555550100, test@example.com…").
3. Submit. Within a few seconds, the row should appear in the Sheet.
4. Delete the test row when done.

## Troubleshooting

- **No row appears in the Sheet**: open `/staff/` (or query the DB) and check
  the new row's `sheets_status` column. If it says `failed`, `sheets_detail`
  has the reason. Common causes:
  - Web app deployment was edited but not redeployed (Apps Script makes you
    create a new "version" — go to **Deploy → Manage deployments → ✏️ → New version**).
  - Sheet tab name doesn't match the `SHEET_NAME` constant in the script.
  - `SHEETS_WEBHOOK_URL` env var was added but the Vercel app wasn't redeployed.

- **Want to change columns**: update both the Sheet header row AND the
  `appendRow([...])` array in the Apps Script. Order must match.

- **Lost the URL**: in Apps Script, **Deploy → Manage deployments**. The
  Web app URL is shown for the active deployment.
