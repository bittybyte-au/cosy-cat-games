/* Every email the site sends. Plain, friendly, no tracking pixels or links other than our own site. */

const wrap = (title, bodyHtml) => `<!doctype html><html><body style="margin:0;background:#9EDCFF;font-family:Arial,Helvetica,sans-serif;color:#2A2340">
<div style="max-width:520px;margin:0 auto;padding:24px 16px">
  <div style="background:#FFF8EC;border:3px solid #2A2340;border-radius:20px;padding:24px">
    <h1 style="margin:0 0 12px;font-size:24px">${title}</h1>
    ${bodyHtml}
    <p style="margin:24px 0 0;font-size:13px;color:#5E5675">Cosy Cat Games: calm little games for kids. No ads, no tracking, no pop-ups.</p>
  </div>
</div></body></html>`;

const button = (href, label) => `<p style="margin:20px 0"><a href="${href}" style="display:inline-block;background:#7BD389;color:#2A2340;border:3px solid #2A2340;border-radius:999px;padding:12px 24px;font-weight:bold;text-decoration:none;font-size:18px">${label}</a></p>`;
const p = (t) => `<p style="font-size:16px">${t}</p>`;
const big = (code) => `<p style="font-size:36px;letter-spacing:8px;font-weight:bold;margin:12px 0">${code}</p>`;

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function maskEmail(email) {
  const [user, domain] = String(email || '').split('@');
  if (!domain) return '';
  return (user.length <= 2 ? user[0] + '*' : user[0] + '***' + user[user.length - 1]) + '@' + domain;
}

const fmtDate = (t, tz) => new Date(t).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: tz || 'Australia/Sydney' });
const fmtTime = (t, tz) => new Date(t).toLocaleString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', timeZone: tz || 'Australia/Sydney' });

/* one code email per purpose; the wording says what typing the code will do */
const CODE_TEXT = {
  pay: ['Your Cosy Cat Games code', 'Type this code to check your email address before paying for the pass:'],
  login: ['Your Cosy Cat Games log-in code', 'Type this code on the device you want to log in on:'],
  join: ['Add a device to your family', 'Someone wants to add a device to your Cosy Cat Games family. If that was you or your child, type this code on that device:'],
  'pin-reset': ['Reset your parent PIN', 'Type this code to set a new parent PIN. It also unlocks PIN entry if it was locked:'],
  delete: ['Delete your Cosy Cat Games account', 'Type this code to permanently delete your family account, its profiles and all progress:'],
  'email-change': ['Confirm your new email', 'Type this code to make this the email address for your Cosy Cat Games family:']
};

export function codeEmail(code, purpose = 'login') {
  const [title, lead] = CODE_TEXT[purpose] || CODE_TEXT.login;
  return {
    subject: `${title}: ${code}`,
    text: `${lead}\n\n${code}\n\nIt works once and ends in 10 minutes. If you didn't ask for this, you can ignore this email.`,
    html: wrap(title, p(lead) + big(code) + `<p style="font-size:15px">It works once and ends in 10 minutes. If you didn't ask for this, you can ignore this email.</p>`)
  };
}

export function askEmail(link, deviceName) {
  return {
    subject: 'Your child would like to unlock Cosy Cat Games',
    text: `Someone on a ${deviceName} asked to unlock Cosy Cat Games and typed in this email address.\n\nA one-year pass unlocks every game on up to 6 devices. It doesn't renew automatically.\n\nTo unlock it: ${link}\n\nOnce you've paid, the ${deviceName} unlocks by itself. This link stops working after 24 hours. If this wasn't you or your child, you can ignore this email.`,
    html: wrap('Your child would like to unlock Cosy Cat Games', p(`Someone on a <b>${esc(deviceName)}</b> asked to unlock Cosy Cat Games and typed in this email address.`) +
      p('A one-year pass unlocks every game on up to 6 devices. It doesn’t renew automatically.') + button(link, 'See the pass') +
      `<p style="font-size:15px">Once you've paid, the ${esc(deviceName)} unlocks by itself. This link stops working after 24 hours. If this wasn't you or your child, you can ignore this email.</p>`)
  };
}

export function reminderEmail(expiresAt, link, tz) {
  const date = fmtDate(expiresAt, tz);
  return {
    subject: `Your Cosy Cat Games pass ends on ${date}`,
    text: `Just a heads-up: your Cosy Cat Games pass ends on ${date}. It won't renew by itself.\n\nTo keep playing, renew from the parent dashboard: ${link}\nRenewing early adds a year on from ${date}, so you don't lose any days. Profiles and progress are kept either way.`,
    html: wrap('Your pass ends soon', p(`Just a heads-up: your Cosy Cat Games pass ends on <b>${date}</b>. It won't renew by itself.`) +
      button(link, 'Renew for another year') + `<p style="font-size:15px">Renewing early adds a year on from ${date}, so you don't lose any days. Profiles and progress are kept either way.</p>`)
  };
}

export function pinLockedEmail(deviceName, at, tz, link) {
  const when = fmtTime(at, tz);
  return {
    subject: 'Parent PIN locked on ' + deviceName,
    text: `The wrong parent PIN was typed 4 times on "${deviceName}" (${when}), so PIN entry on that device is locked for 1 hour. The games still work.\n\nIf this was you and you've forgotten the PIN, you can reset it: ${link}\nIf it wasn't you, a child may have been guessing. Nothing else has changed.`,
    html: wrap('Parent PIN locked', p(`The wrong parent PIN was typed 4 times on <b>${esc(deviceName)}</b> (${esc(when)}), so PIN entry on that device is locked for 1 hour. The games still work.`) +
      button(link, 'Reset PIN') + `<p style="font-size:15px">If it wasn't you, a child may have been guessing. Nothing else has changed.</p>`)
  };
}

export function emailChangedEmail(newEmailMasked, undoLink) {
  return {
    subject: 'Your Cosy Cat Games email was changed',
    text: `The email address for your Cosy Cat Games family was changed to ${newEmailMasked}.\n\nIf you didn't do this, undo it within 7 days: ${undoLink}`,
    html: wrap('Your email was changed', p(`The email address for your Cosy Cat Games family was changed to <b>${esc(newEmailMasked)}</b>.`) +
      p('If you didn’t do this, you can undo it for the next 7 days.') + button(undoLink, 'Undo this change'))
  };
}

export function deleteWarningEmail(deleteAt, link, tz) {
  const date = fmtDate(deleteAt, tz);
  return {
    subject: 'Your Cosy Cat Games account will be deleted on ' + date,
    text: `Your Cosy Cat Games family account hasn't been used for 2 years, so we'll delete it and all its progress on ${date}.\n\nTo keep it, just open the games on any of your devices before then: ${link}`,
    html: wrap('We’ll tidy up your account soon', p(`Your Cosy Cat Games family account hasn't been used for 2 years, so we'll delete it and all its progress on <b>${date}</b>.`) +
      p('To keep it, just open the games on any of your devices before then.') + button(link, 'Open Cosy Cat Games'))
  };
}
