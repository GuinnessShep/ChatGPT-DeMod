// ==UserScript==
// @name         ChatGPT DeMod
// @namespace    pl.4as.chatgpt
// @version      1.2
// @description  Prevents moderation checks during conversations with ChatGPT
// @author       4as
// @match        *://chat.openai.com/*
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @downloadURL  https://github.com/StealthC/ChatGPT-DeMod/raw/main/ChatGPT%20DeMod.user.js
// @updateURL    https://github.com/StealthC/ChatGPT-DeMod/raw/main/ChatGPT%20DeMod.user.js
// @require      https://openuserjs.org/src/libs/sizzle/GM_config.js
// @grant        GM.setValue
// @grant        GM.getValue
// @run-at       document-start
// ==/UserScript==
'use strict';

GM_config.init(
    {
        'id': 'ChatGPT DeMod Config', // The id used for this instance of GM_config
        'fields': // Fields object
        {
            'conversations_url': // This is the id of the field
            {
                'label': 'Conversations URL', // Appears next to field
                'type': 'text', // Makes this setting a text field
                'default': 'https://raw.githubusercontent.com/4as/ChatGPT-DeMod/main/conversations.json' // Default value if user doesn't change it
            }
        }
    });

GM_config.onSave = async () => {
    RefreshConversations(GM_config.get('conversations_url'));
}
var url = GM_config.get('conversations_url');
var has_conversations;
var conversations;

function getOpening() {
    if (!has_conversations) return "Hi";
    var idx = Math.floor(Math.random() * conversations.openings.length);
    return conversations.openings[idx];
}

var conversation_page = 0;
var conversation_idx = 0;
function getConversation() {
    if (!has_conversations) return "Can you tell me what exactly can you do?";
    if (conversation_page >= conversations.conversations.length) conversation_page = 0;
    if (conversation_idx == conversations.conversations[conversation_page].length) return null;
    let message = conversations.conversations[conversation_page][conversation_idx];
    conversation_idx++;
    return message;
}

function getEnding() {
    if (!has_conversations) return "Can you tell me what exactly can you do?";
    conversation_page++;
    conversation_idx = 0;
    var idx = Math.floor(Math.random() * conversations.endings.length);
    return conversations.endings[idx];
}

const DEMOD_KEY = 'DeModState';
var is_on = false;

// Adding DeMod button
const demod_div = document.createElement('div');
const demod_button = document.createElement('button');
const demod_config_button = document.createElement('button');
demod_div.appendChild(demod_button);
demod_div.appendChild(demod_config_button);
updateDeModState()

demod_div.style.display = "flex"
demod_div.style.justifyContent = "space-between";
demod_div.style.gap = "1em";
demod_div.style.alignItems = "center";
demod_div.style.position = 'fixed';
demod_div.style.bottom = '2px';
demod_div.style.left = '50%';
demod_div.style.transform = 'translate(-50%, 0%)';
demod_div.style.color = 'white';
demod_div.style.padding = '12px 20px';
demod_div.style.border = 'none';
demod_div.style.cursor = 'pointer';
demod_div.style.outline = 'none';
demod_div.style.borderRadius = '4px';
demod_div.style.opacity = '50%'
demod_div.style.zIndex = 999;

demod_button.addEventListener('click', () => {
    is_on = !is_on;
    GM.setValue(DEMOD_KEY, is_on);
    updateDeModState();
});

function updateDeModState() {
    demod_button.textContent = "DeMod: " + (is_on ? "On" : "Off");
    demod_div.style.backgroundColor = is_on ? '#4CAF50' : '#AF4C50';
}

demod_config_button.textContent = "⚙️"

demod_config_button.addEventListener('click', () => {
    GM_config.open();
});

var current_message = null;
var used_opening = Math.random() > 0.5;
var currently_responding = false;
var intercept_count_normal = 0;
var intercept_count_extended = 0;
var intercept_count_total = 0;

const original_fetch = unsafeWindow.fetch;

unsafeWindow.fetch = async (...arg) => {
    if (has_conversations && arg[0].indexOf('/moderation') != -1) {
        if (is_on) {
            intercept_count_total++;
            var body = JSON.parse(arg[1].body);
            if (body.hasOwnProperty("input")) {
                var text = null;
                if (currently_responding) {
                    text = current_message.input + "\n\n" + current_message.output;
                }
                else {
                    if (!used_opening) {
                        current_message = getOpening();
                    }
                    else {
                        current_message = getConversation();
                        if (current_message == null) current_message = getEnding();
                    }
                    text = current_message.input;
                }
                if (text == null) text = "Hi!";
                intercept_count_normal++;
                body.input = text;
            }
            else {
                var intercepted = false;
                for (var j = 0; j < body.messages.length; j++) {
                    var msg = body.messages[j];
                    if (msg.content.content_type == "text") {
                        msg.content.parts = [current_message.output];
                        intercepted = true;
                    }
                }
                if (intercepted) {
                    intercept_count_extended++;
                }
                else {
                    console.error("Moderation call interception failed, unknown format! Message:\n" + JSON.stringify(body));
                }
            }
            console.log("Moderation call intercepted. Normal count: " + intercept_count_normal + ", extended count: " + intercept_count_extended + ", total: " + intercept_count_total);
            currently_responding = !currently_responding;
            arg[1].body = JSON.stringify(body);
        }
        used_opening = true;
    }
    return original_fetch(...arg);
}

async function RefreshConversations(url) {
    'use strict';
    is_on = await GM.getValue(DEMOD_KEY, false);
    await fetch(url)
        .then(res => res.json())
        .then(out => { (conversations = out); has_conversations = true; console.log("Conversations loaded! Openings: " + conversations.openings.length + ", main: " + conversations.conversations.length + ", endings: " + conversations.endings.length); })
        .catch(err => { console.log("Failed to download conversations: " + err); });
    if (conversations != null) {
        conversation_page = Math.floor(Math.random() * conversations.conversations.length);
        demod_button.disabled = false;
        updateDeModState();
    } else {
        demod_button.textContent = "Error fetching conversations!"
        demod_button.disabled = true;
    }

    XMLHttpRequest.prototype.realOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url, async, user, password) {
        if (is_on && url.indexOf("/track/?") != -1) return;
        this.realOpen(method, url, async, user, password);
    }
}

(async () => {
    if (!demod_div.parentNode) {
        document.body.appendChild(demod_div);
    }
    return RefreshConversations(url)

})();
