(function () {
  if (window.top !== window) return;

  function pollIdOf(form) {
    const box = form.closest('[id^="polls-"]');
    const match = box && /^polls-(\d+)$/.exec(box.id);
    return match ? match[1] : '';
  }

  function votedCookie(pollId) {
    const name = `voted_${pollId}`;
    const parts = document.cookie ? document.cookie.split(';') : [];
    for (const part of parts) {
      const item = part.trim();
      const eq = item.indexOf('=');
      if (eq > 0 && item.slice(0, eq) === name) return true;
    }
    return false;
  }

  // The isolated content script cannot run the page's inline poll_vote handler.
  // A cast vote is the site cookie voted_<poll id>, not something the extension stores.
  document.addEventListener('nomybb-poll-other', () => {
    const forms = document.querySelectorAll('form.wp-polls-form[data-nomybb-vote-input]');
    for (const form of forms) {
      if (form.dataset.nomybbPollVote === '1') continue;
      const pollId = pollIdOf(form);
      if (!pollId || votedCookie(pollId) || typeof poll_vote !== 'function') continue;
      const inputId = form.dataset.nomybbVoteInput || '';
      const input = inputId ? document.getElementById(inputId) : null;
      if (!input || !form.contains(input)) continue;
      input.checked = true;
      try {
        poll_vote(Number(pollId));
      } catch {
        continue;
      }
      form.dataset.nomybbPollVote = '1';
    }
  });
})();
