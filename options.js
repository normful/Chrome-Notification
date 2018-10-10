// Copyright (c) 2015, Derek Guenther
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0

const storageKey = 'bunpro_api_key';

// Saves options to Chrome Sync.
function save_options() {
  var key_field = document.getElementById('api_key');
  var api_key = key_field.value;

  // Clear the storage so we don't persist old data.
  chrome.storage.sync.remove(storageKey, function() {
    // Clear our local cached data
    chrome.storage.local.clear();

    // While we're at it, clear our refresh alarm as well.
    chrome.alarms.clear('refresh');

    // Test out the new api key.
    var xhr = new XMLHttpRequest();
    const handler = function() {
      if (xhr.readyState !== 4) {
        return;
      }

      let parsed;
      try {
        parsed = JSON.parse(xhr.responseText);
      } catch (e) {
        chrome.extension.getBackgroundPage().update_badge('!');
        // Also, notify the user.
        show_status("Sorry, that API key isn't valid. Please try again!");
        return;
      }

      // Store the api key in Chrome Sync.
      chrome.storage.sync.set({ [storageKey]: api_key }, function() {
        // Update status to let user know options were saved.
        show_status(
          'Your options have been saved. Thanks, ' +
            String(parsed.user_information.username) +
            '!'
        );
      });
    };
    const url = `https://www.bunpro.jp/api/user/${api_key}/study_queue`;
    xhr.open('GET', url);

    // Super hacky workaround for 401 being returned by API, even in successful case.
    xhr.onreadystatechange = handler;
    xhr.send();
  });

  // Save notification options.
  save_notifications();

  chrome.extension.getBackgroundPage().show_notification();
}

// Save notification options.
function save_notifications() {
  var notif_elems = document.getElementsByName('notifications');
  for (var i = 0; i < notif_elems.length; i++) {
    if (notif_elems[i].type === 'radio' && notif_elems[i].checked) {
      chrome.storage.sync.set({ notifications: notif_elems[i].value });
      return;
    }
  }
}

// Restore all options to their form elements.
function restore_options() {
  restore_notifications();
  restore_api_key();
}

// Restore API key text box.
function restore_api_key() {
  chrome.storage.sync.get(storageKey, function(data) {
    var api_key = data[storageKey];
    // If no API key is stored, leave the text box blank.
    // We don't set a default value for the API key because it must be set
    // for the extension to work.
    if (!api_key) {
      return;
    }
    var key_field = document.getElementById('api_key');
    key_field.value = api_key;
  });
}

// Restore notification radio buttons.
function restore_notifications() {
  chrome.storage.sync.get('notifications', function(data) {
    var notifications = data.notifications;

    // If notifications hasn't been set yet, default it to off
    if (!notifications) {
      chrome.storage.sync.set({ notifications: 'off' }, function() {
        document.getElementById('notif_off').checked = true;
      });
    } else {
      if (notifications === 'on') {
        document.getElementById('notif_on').checked = true;
      } else if (notifications === 'off') {
        document.getElementById('notif_off').checked = true;
      }
    }
  });
}

function show_status(status) {
  var statusEl = document.getElementById('status');
  statusEl.innerHTML = status;
  setTimeout(function() {
    statusEl.innerHTML = '';
  }, 4000);
}

document.addEventListener('DOMContentLoaded', restore_options);
document.addEventListener('DOMContentLoaded', function bind_save() {
  document.querySelector('#save').addEventListener('click', save_options);
});
