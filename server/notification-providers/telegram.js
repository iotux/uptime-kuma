const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class Telegram extends NotificationProvider {
    name = "telegram";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";
        const url = notification.telegramServerUrl ?? "https://api.telegram.org";

        try {
            let params = {
                chat_id: notification.telegramChatID,
                text: msg,
                disable_notification: notification.telegramSendSilently ?? false,
                protect_content: notification.telegramProtectContent ?? false,
                link_preview_options: { is_disabled: true },
            };
            if (notification.telegramMessageThreadID) {
                params.message_thread_id = notification.telegramMessageThreadID;
            }

            if (notification.telegramUseTemplate) {
                if (notification.telegramTemplateParseMode === "MarkdownV2") {
                    if (typeof msg !== "string") {
                        msg = JSON.stringify(msg);
                    }
                    msg = this.escapeMarkdownV2(msg);
                    monitorJSON = this.escapeMarkdownV2(monitorJSON);
                    heartbeatJSON = this.escapeMarkdownV2(heartbeatJSON);
                }

                params.text = await this.renderTemplate(notification.telegramTemplate, msg, monitorJSON, heartbeatJSON);

                if (notification.telegramTemplateParseMode !== "plain") {
                    params.parse_mode = notification.telegramTemplateParseMode;
                }
            }

            let config = this.getAxiosConfigWithProxy();

            await axios.post(`${url}/bot${notification.telegramBotToken}/sendMessage`, params, config);
            return okMsg;

        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }

    /**
     * Escape special characters for Telegram MarkdownV2.
     * If the input is a string, it escapes it.
     * If the input is an object, it performs a shallow escape of all string properties.
     * @param {string|object} value The value to escape
     * @returns {string|object} The escaped value
     */
    escapeMarkdownV2(value) {
        if (typeof value === "string") {
            return value.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
        }
        if (typeof value === "object" && value !== null) {
            const copy = Array.isArray(value) ? [ ...value ] : { ...value };
            for (const key in copy) {
                if (typeof copy[key] === "string") {
                    copy[key] = copy[key].replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
                }
            }
            return copy;
        }
        return value;
    }
}

module.exports = Telegram;
