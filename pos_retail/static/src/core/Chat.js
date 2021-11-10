odoo.define('pos_retail.chat', function (require) {
    "use strict";

    var chrome = require('point_of_sale.chrome');
    var config = require('web.config');
    var core = require('web.core');
    var PosBaseWidget = require('point_of_sale.BaseWidget');
    var gui = require('point_of_sale.gui');
    var Discuss = require('mail.Discuss');
    var QWeb = core.qweb;
    var _t = core._t;

    Discuss.include({
        _renderSidebar: function (options) {
            var self = this;
            if (!$('.o_mail_systray_item').hasClass('oe_hidden')) {
                $('.o_mail_systray_item').addClass('oe_hidden');
            }
            var $Sidebar = this._super.apply(this, arguments);
            if (window.location.pathname == '/pos/web') {
                $Sidebar.find('div.back_to_pos').removeClass('hide').on("click", function () {
                    self.do_action("pos.ui");
                });
            }
            return $Sidebar;
        },
    });

    var MessageWidget = PosBaseWidget.extend({
        template: 'MessageWidget',
        init: function (parent, options) {
            options = options || {};
            this._super(parent, options);
        },
        events: {
            'click .o_mail_preview': '_onClickPreview',
            'click .o_filter_button': '_onClickFilterButton',
            'click .o_new_message': '_onClickNewMessage',
            'click .o_mail_preview_mark_as_read': '_onClickPreviewMarkAsRead',
            'click .o_thread_window_expand': '_onClickExpand',
            'show.bs.dropdown': '_onShowDropdown',
        },
        _onShowDropdown: function () {
            this._updatePreviews();
        },
        isMobile: function () {
            return config.device.isMobile;
        },
        close: function () {
        },
        _updatePreviews: function () {
            // Display spinner while waiting for conversations preview
            this._$previews.html(QWeb.render('Spinner'));
            if (!this._isMessagingReady) {
                return;
            }
            this._getPreviews()
                .then(this._renderPreviews.bind(this));
        },
        _getPreviews: function () {
            return this.call('mail_service', 'getSystrayPreviews', this._filter);
        },
        _renderPreviews: function (previews) {
            this._$previews.html(QWeb.render('mail.systray.MessagingMenu.Previews', {
                previews: previews,
            }));
        },
        willStart: function () {
            this._isMessagingReady = this.call('mail_service', 'isReady');
            return $.when(this._super.apply(this, arguments), this._isMessagingReady);
        },
        /**
         * Opens the related document
         *
         * @private
         * @param {MouseEvent} ev
         */
        _onClickExpand: function (ev) {
            ev.stopPropagation();
            var $preview = $(ev.currentTarget).closest('.o_mail_preview');
            var documentModel = $preview.data('document-model');
            var documentID = $preview.data('document-id');
            this._openDocument(documentModel, documentID);
        },
        /**
         * @override
         */
        start: function () {
            this._$filterButtons = this.$('.o_filter_button');
            this._$previews = this.$('.o_mail_systray_dropdown_items');
            this._filter = false;
            this._updateCounter();
            var mailBus = this.call('mail_service', 'getMailBus');
            mailBus.on('messaging_ready', this, this._onMessagingReady);
            mailBus.on('update_needaction', this, this._updateCounter);
            mailBus.on('new_channel', this, this._updateCounter);
            mailBus.on('update_thread_unread_counter', this, this._updateCounter);
            return this._super.apply(this, arguments);
        },
        _onMessagingReady: function () {
            if (this._isMessagingReady) {
                return;
            }
            this._isMessagingReady = true;
            this._updateCounter();
        },
        _openDiscuss: function (channelID) {
            var self = this;
            var discussOptions = {clear_breadcrumbs: true};

            if (channelID) {
                discussOptions.active_id = channelID;
            }

            this.do_action('mail.action_discuss', discussOptions)
                .then(function () {
                    // we cannot 'go back to previous page' otherwise
                    self.trigger_up('hide_home_menu');
                    core.bus.trigger('change_menu_section',
                        self.call('mail_service', 'getDiscussMenuID'));
                });
        },
        _openDocument: function (documentModel, documentID) {
            if (documentModel === 'mail.channel') {
                this._openDiscuss(documentID);
            } else {
                var url = window.location.origin + "/web?#" +
                    "id=" + documentID + "&model=" + documentModel +
                    "&view_type=form&cids=" + $.bbq.getState().cids;
                window.open(url, '_blank');
            }
        },
        _updateCounter: function () {
            if (!this._isMessagingReady) {
                return;
            }
            var counter = this._computeCounter();
            $('.o_notification_counter').text(counter);
            this.$el.toggleClass('o_no_notification', !counter);
            this._updatePreviews();
        },
        /**
         * Compute the counter next to the systray messaging menu. This counter is
         * the sum of unread messages in channels, the counter of the mailbox inbox,
         * and the amount of mail failures.
         *
         * @private
         * @returns {integer}
         */
        _computeCounter: function () {
            var channels = this.call('mail_service', 'getChannels');
            var channelUnreadCounters = _.map(channels, function (channel) {
                return channel.getUnreadCounter();
            });
            var unreadChannelCounter = _.reduce(channelUnreadCounters, function (acc, c) {
                return c > 0 ? acc + 1 : acc;
            }, 0);
            var inboxCounter = this.call('mail_service', 'getMailbox', 'inbox').getMailboxCounter();
            var mailFailureCounter = this.call('mail_service', 'getMailFailures').length;

            return unreadChannelCounter + inboxCounter + mailFailureCounter;
        },
        _openDocument: function (documentModel, documentID) {
            if (documentModel === 'mail.channel') {
                this._openDiscuss(documentID);
            } else {
                this.do_action({
                    type: 'ir.actions.act_window',
                    res_model: documentModel,
                    views: [[false, 'form']],
                    res_id: documentID
                });
            }
        },
        /**
         * @private
         * @param {MouseEvent} ev
         */
        _onClickFilterButton: function (ev) {
            ev.stopPropagation();
            this._$filterButtons.removeClass('active');
            var $target = $(ev.currentTarget);
            $target.addClass('active');
            this._filter = $target.data('filter');
            this._updatePreviews();
        },
        _updatePreviews: function () {
            // Display spinner while waiting for conversations preview
            this._$previews.html(QWeb.render('Spinner'));
            this._getPreviews()
                .then(this._renderPreviews.bind(this));
        },
        _getPreviews: function () {
            return this.call('mail_service', 'getSystrayPreviews', this._filter);
        },
        _renderPreviews: function (previews) {
            this._$previews.html(QWeb.render('mail.systray.MessagingMenu.Previews', {
                previews: previews,
            }));
        },
        _onClickNewMessage: function () {
            this.call('mail_service', 'openBlankThreadWindow');
        },
        _onClickPreviewMarkAsRead: function (ev) {
            ev.stopPropagation();
            var thread;
            var $preview = $(ev.currentTarget).closest('.o_mail_preview');
            var previewID = $preview.data('preview-id');
            if (previewID === 'mailbox_inbox') {
                var messageIDs = [].concat($preview.data('message-ids'));
                this.call('mail_service', 'markMessagesAsRead', messageIDs);
            } else if (previewID === 'mail_failure') {
                var documentModel = $preview.data('document-model');
                var unreadCounter = $preview.data('unread-counter');
                this.do_action('mail.mail_resend_cancel_action', {
                    additional_context: {
                        default_model: documentModel,
                        unread_counter: unreadCounter
                    }
                });
            } else {
                // this is mark as read on a thread
                thread = this.call('mail_service', 'getThread', previewID);
                if (thread) {
                    thread.markAsRead();
                }
            }
        },
        _onClickPreview: function (ev) {
            var $target = $(ev.currentTarget);
            var previewID = $target.data('preview-id');
            if (previewID === 'mail_failure') {
                this._clickMailFailurePreview($target);
            } else if (previewID === 'mailbox_inbox') {
                // inbox preview for non-document thread,
                // e.g. needaction message of channel
                var documentID = $target.data('document-id');
                var documentModel = $target.data('document-model');
                if (!documentModel) {
                    this._openDiscuss('mailbox_inbox');
                } else {
                    this._openDocument(documentModel, documentID);
                }
            } else {
                // preview of thread
                this.call('mail_service', 'openThread', previewID);
            }
        },
        _clickMailFailurePreview: function ($target) {
            var documentID = $target.data('document-id');
            var documentModel = $target.data('document-model');
            if (documentModel && documentID) {
                this._openDocument(documentModel, documentID);
            } else if (documentModel !== 'mail.channel') {
                // preview of mail failures grouped to different document of same model
                this.do_action({
                    name: "Mail failures",
                    type: 'ir.actions.act_window',
                    view_mode: 'kanban,list,form',
                    views: [[false, 'kanban'], [false, 'list'], [false, 'form']],
                    target: 'current',
                    res_model: documentModel,
                    domain: [['message_has_error', '=', true]],
                });
            }
        },

    });
    gui.define_popup({name: 'message', widget: MessageWidget});

    chrome.Chrome.include({
        events: {
            'click .pos_chat': '_onActivityMenuShow',
        },
        _onActivityMenuShow: function () {
            this.gui.show_popup('message', {});
        },
        build_widgets: function () {
            var self = this;
            this._super();
            if (this.pos.config.chat) {
                $('div.pos_chat').find('i').attr('aria-hidden', 'false');
                if (this.pos.message_open == false) {
                    $('.message').removeClass('oe_hidden');
                    self.pos.message_open = true;
                }
                if (this.pos.message_open == true) {
                    $('.message').addClass('oe_hidden');
                    self.pos.message_open = false;
                }
            }
        },
    });

    var ChatWidget = chrome.StatusWidget.extend({
        template: 'ChatWidget',
        init: function () {
            this._super(arguments[0], {});
            this.pos.message_open = false;
        },
        start: function () {
            var self = this;
            this._super();
            this.$el.click(function () {
                if (!self.pos.message_open) {
                    self.gui.show_popup('message', {});
                    self.pos.message_open = true;
                    $('.message').removeClass('oe_hidden');
                } else {
                    self.pos.message_open = false;
                    $('.message').addClass('oe_hidden');
                }
            });
        }
    });

    chrome.Chrome.include({
        build_widgets: function () {
            if (this.pos.config.chat) {
                this.widgets.push(
                    {
                        name: 'ChatWidget',
                        widget: ChatWidget,
                        append: '.pos-rightheader'
                    }
                );
            }
            this._super();
        }
    });
});
