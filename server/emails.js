/* The three emails the pass sends. Plain, friendly, no tracking pixels or links other than our own site. */

const wrap = (title, bodyHtml) => `<!doctype html><html><body style="margin:0;background:#9EDCFF;font-family:Arial,Helvetica,sans-serif;color:#2A2340">
<div style="max-width:520px;margin:0 auto;padding:24px 16px">
  <div style="background:#FFF8EC;border:3px solid #2A2340;border-radius:20px;padding:24px">
    <h1 style="margin:0 0 12px;font-size:24px">${title}</h1>
    ${bodyHtml}
    <p style="margin:24px 0 0;font-size:13px;color:#5E5675">Cosy Cat Games: calm little games for kids. No ads, no tracking, no pop-ups.</p>
  </div>
</div></body></html>`;

const button = (href, label) => `<p style="margin:20px 0"><a href="${href}" style="display:inline-block;background:#7BD389;color:#2A2340;border:3px solid #2A2340;border-radius:999px;padding:12px 24px;font-weight:bold;text-decoration:none;font-size:18px">${label}</a></p>`;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function maskEmail(email) {
  const [user, domain] = String(email || '').split('@');
  if (!domain) return '';
  return (user.length <= 2 ? user[0] + '*' : user[0] + '***' + user[user.length - 1]) + '@' + domain;
}

export function codeEmail(code) {
  return {
    subject: `Your Cosy Cat Games code: ${code}`,
    text: `Your sign-in code is ${code}\n\nType it on the device you want to unlock. It works once and ends in 10 minutes.\n\nIf you didn't ask for this, you can ignore this email.`,
    html: wrap('Your sign-in code', `<p style="font-size:16px">Type this code on the device you want to unlock:</p>
      <p style="font-size:36px;letter-spacing:8px;font-weight:bold;margin:12px 0">${code}</p>
      <p style="font-size:15px">It works once and ends in 10 minutes. If you didn't ask for this, you can ignore this email.</p>`)
  };
}

export function askEmail(link, deviceName) {
  return {
    subject: 'Your child would like to unlock Cosy Cat Games',
    text: `Someone on a ${deviceName} asked to unlock Cosy Cat Games and typed in this email address.\n\nA one-year pass unlocks every game on up to 6 devices. It doesn't renew automatically.\n\nTo unlock it: ${link}\n\nOnce you've paid, the ${deviceName} unlocks by itself. This link stops working after 24 hours. If this wasn't you or your child, you can ignore this email.`,
    html: wrap('Your child would like to unlock Cosy Cat Games', `<p style="font-size:16px">Someone on a <b>${esc(deviceName)}</b> asked to unlock Cosy Cat Games and typed in this email address.</p>
      <p style="font-size:16px">A one-year pass unlocks every game on up to 6 devices. It doesn't renew automatically.</p>
      ${button(link, 'See the pass')}
      <p style="font-size:15px">Once you've paid, the ${esc(deviceName)} unlocks by itself. This link stops working after 24 hours. If this wasn't you or your child, you can ignore this email.</p>`)
  };
}

export function reminderEmail(expiresAt, link) {
  const date = new Date(expiresAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Sydney' });
  return {
    subject: `Your Cosy Cat Games pass ends on ${date}`,
    text: `Just a heads-up: your Cosy Cat Games pass ends on ${date}. It won't renew by itself.\n\nTo keep playing, renew from any of your devices: ${link}\nRenewing early adds a year on from ${date}, so you don't lose any days.`,
    html: wrap('Your pass ends soon', `<p style="font-size:16px">Just a heads-up: your Cosy Cat Games pass ends on <b>${date}</b>. It won't renew by itself.</p>
      ${button(link, 'Renew for another year')}
      <p style="font-size:15px">Renewing early adds a year on from ${date}, so you don't lose any days.</p>`)
  };
}
