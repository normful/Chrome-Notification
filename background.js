// Copyright (c) 2015, Derek Guenther
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0

var REFRESH_ALARM = 'refresh';

const REPEATING_ALARM_DELAY_IN_MINUTES = 1;

const storageKey = 'bunpro_api_key';

const bunproStudyUrl = 'https://www.bunpro.jp/study';
const noop = function() {};

const Log = {
  info: (...args) => {
    console.log(...args);
  },
};

// Pull new data from the API
function fetch_reviews() {
  Log.info('fetch_reviews');
  chrome.storage.sync.get(storageKey, function(data) {
    var api_key = data[storageKey];
    if (!api_key) {
      Log.info('fetch_reviews no api key');
      // If the API key isn't set, we can't do anything
      update_badge('!');
    } else {
      Log.info('fetch_reviews fetching');
      let xhr = new XMLHttpRequest();

      const handler = function() {
        if (xhr.readyState !== 4) {
          return;
        }

        let parsed;

        try {
          parsed = JSON.parse(xhr.responseText);
        } catch (e) {
          console.error('JSON parse error', e);
          return;
        }

        if (!parsed.requested_information) {
          return;
        }

        const {
          reviews_available,
          next_review_date,
        } = parsed.requested_information;

        set_review_count(reviews_available);
        set_next_review(next_review_date);
      };

      const url = `https://www.bunpro.jp/api/user/${api_key}/study_queue`;
      xhr.open('GET', url);

      // Super hacky workaround for 401 being returned by API, even in successful case.
      xhr.onreadystatechange = handler;
      xhr.send();
    }
  });
}

// Set the time of the next review.
function set_next_review(epochSeconds) {
  var nextReviewDate = new Date(epochSeconds * 1000);
  Log.info('set_next_review', nextReviewDate.toUTCString());

  chrome.storage.local.set({ next_review: nextReviewDate }, () => {
    if (nextReviewDate > Date.now()) {
      // Refresh when it's time to study
      set_one_time_alarm(nextReviewDate);
    } else {
      set_repeating_alarm();
    }
  });
}

// Set the number of reviews available and notify the user.
function set_review_count(newReviewCount) {
  Log.info('set_review_count', newReviewCount);
  update_badge(String(newReviewCount));

  chrome.storage.local.get('reviews_available', data => {
    const oldReviewCount = data.reviews_available || 0;
    chrome.storage.local.set({ reviews_available: newReviewCount }, () => {
      if (newReviewCount > oldReviewCount) {
        show_notification();
      }
    });
  });
}

function set_repeating_alarm() {
  Log.info('set_repeating_alarm');
  chrome.alarms.create(REFRESH_ALARM, {
    delayInMinutes: REPEATING_ALARM_DELAY_IN_MINUTES,
  });
}

function set_one_time_alarm(time) {
  Log.info('set_one_time_alarm');
  chrome.alarms.create(REFRESH_ALARM, { when: time });
  chrome.alarms.get(REFRESH_ALARM, alarm => {
    console.log('Refreshing at: ', new Date(alarm.scheduledTime).toUTCString());
  });
}

// If notifications are enabled, display a notification.
function show_notification() {
  Log.info('show_notification');
  chrome.storage.sync.get('notifications', function(data) {
    if (data.notifications && data.notifications === 'on') {
      const opt = {
        type: 'basic',
        title: 'Bunpro',
        message: 'You have new reviews on Bunpro!',
        iconUrl: 'icon_128.png',
      };
      chrome.notifications.create('review', opt, noop);
    }
  });
}

// Update the badge text.
function update_badge(badgeText) {
  Log.info('update_badge', badgeText);
  chrome.browserAction.setBadgeText({ text: badgeText });
}

// Open the options page on install.
chrome.runtime.onInstalled.addListener(function(details) {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: 'options.html' });
  }
});

// When the extension's icon is clicked:
chrome.browserAction.onClicked.addListener(function() {
  // If no API key is saved, redirect to the options page. Else open a tab to Bunpro.
  chrome.storage.sync.get(storageKey, function(data) {
    var api_key = data[storageKey];
    if (!api_key) {
      chrome.tabs.create({ url: 'options.html' });
    } else {
      fetch_reviews();
      chrome.tabs.create({ url: bunproStudyUrl });
    }
  });
});

// When a notification is clicked:
chrome.notifications.onClicked.addListener(function() {
  chrome.tabs.create({ url: bunproStudyUrl });
  chrome.notifications.clear('review');
});

// When a "refresh" alarm goes off, fetch new data.
chrome.alarms.onAlarm.addListener(function(alarm) {
  if (alarm.name === REFRESH_ALARM) {
    fetch_reviews();
  }
});

// // If the content page sends a message, update local data.
// chrome.extension.onMessage.addListener(function(request) {
//   if (typeof request.reviews_available !== 'undefined') {
//     set_review_count(request.reviews_available);
//   }
// });

chrome.storage.onChanged.addListener(function(changes) {
  var key;
  for (key in changes) {
    if (changes.hasOwnProperty(key) && key === storageKey) {
      fetch_reviews();
    }
  }
});

fetch_reviews();
