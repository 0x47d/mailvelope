/**
 * Mailvelope - secure email with OpenPGP encryption for Webmail
 * Copyright (C) 2012  Thomas Oberndörfer
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License version 3
 * as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

'use strict';

var mvelo = mvelo || null;

(function() {
  // communication to background page
  var port;
  // shares ID with VerifyFrame
  var id;
  var watermark;
  var spinnerTimer;
  var commonPath;
  var l10n;

  function init() {
    //console.log('init decryptInline.js');
    var qs = jQuery.parseQuerystring();
    id = 'vDialog-' + qs.id;
    // open port to background page
    port = mvelo.extension.connect({name: id});
    port.onMessage.addListener(messageListener);
    port.postMessage({event: 'verify-inline-init', sender: id});
    if (mvelo.crx) {
      commonPath = '../../..';
    } else if (mvelo.ffa) {
      commonPath = mvelo.extension._dataPath + 'common';
    }
    addWrapper();
    addSandbox();
    // mvelo.extension.sendMessage({event: "get-security-token"}, function(token) {
    //   $('#watermark').html(mvelo.util.encodeHTML(token.code));
    // });
    $(window).on('resize', resizeFont);
    addSpinner();
    addErrorView();
    // show spinner
    spinnerTimer = setTimeout(showSpinner, 600);
    mvelo.l10n.getMessages([
      'verify_result_success',
      'verify_result_warning',
      'verify_result_error',
      'alert_header_error',
      'dialog_keyid_label'
    ], function(result) {
      l10n = result;
    });
    mvelo.util.showSecurityBackground();
  }

  function showSpinner() {
    mvelo.util.showLoadingAnimation();
  }

  function addSpinner() {
    var spinner = $('<div class="m-spinner" style="position: fixed; width: 100%; margin: 15px auto 60px;"><div class="bounce1"></div><div class="bounce2"></div><div class="bounce3"></div></div>');
    $('body').append(spinner);
    mvelo.util.hideLoadingAnimation();
  }

  function addWrapper() {
    var wrapper = $('<div/>', {id: 'wrapper'});
    watermark = $('<div/>', {id: 'watermark'});
    watermark.appendTo(wrapper);
    wrapper.appendTo('body');
  }

  function addSandbox() {
    var sandbox = $('<iframe/>', {
      id: 'verifymail',
      sandbox: 'allow-same-origin allow-popups',
      frameBorder: 0
    });
    var header = $('<header/>');
    var content = $('<div/>', {
      id: 'content'
    }).append(header);
    var style = $('<link/>', {
      rel: 'stylesheet',
      href: commonPath + '/dep/bootstrap/css/bootstrap.css'
    });
    //var style2 = style.clone().attr('href', commonPath + '/dep/wysihtml5/css/wysihtml5.css');
    var style3 = style.clone().attr('href', commonPath + '/ui/inline/dialogs/verifyInlineSig.css');
    var meta = $('<meta/>', { charset: 'UTF-8' });
    sandbox.on('load', function() {
      $(this).contents().find('head').append(meta)
                                     .append(style)
      //                               .append(style2)
                                     .append(style3);
      $(this).contents().find('body').css('background-color', 'rgba(0,0,0,0)');
      $(this).contents().find('body').append(content);
    });
    $('#wrapper').append(sandbox);
  }

  function addErrorView() {
    var errorbox = $('<div/>', {id: 'errorbox'});
    $('<div/>', {id: 'errorwell', class: 'well span5'}).appendTo(errorbox);
    errorbox.appendTo('body');
    if ($('body').height() + 2 > mvelo.LARGE_FRAME) {
      $('#errorbox').addClass('errorbox-large');
    }
  }

  function showMessageArea() {
    $('html, body').addClass('hide_bg');
    $('body').addClass('secureBackground');
    $('#wrapper').fadeIn();
    resizeFont();
  }

  function addSecuritySettingsButton() {
    var securitySettingsBtn = $('<button id="secureBgndSettingsBtn" class="btn btn-link pull-right"><span class="glyphicon lockBtnIcon"></span></button>');
    $('body').append(securitySettingsBtn);
  }

  function showErrorMsg(msg) {
    //$('body').removeClass('spinner');
    mvelo.util.hideLoadingAnimation();
    clearTimeout(spinnerTimer);
    $('#errorbox').show();
    $('#errorwell').showAlert(l10n.alert_header_error, msg, 'danger')
                   .find('.alert').prepend($('<button/>', {type: 'button', class: 'close', html: '&times;'}))
                   .find('button').click(function() {
                      port.postMessage({event: 'verify-dialog-cancel', sender: id});
                    });
  }

  function resizeFont() {
    watermark.css('font-size', Math.floor(Math.min(watermark.width() / 3, watermark.height())));
  }

  function messageListener(msg) {
    //console.log('decrypt dialog messageListener: ', JSON.stringify(msg));
    switch (msg.event) {
      case 'verified-message':
        showMessageArea();
        addSecuritySettingsButton();
        // js execution is prevented by Content Security Policy directive: "script-src 'self' chrome-extension-resource:"
        var message = msg.message.replace(/\n/g, '<br>');
        var node = $('#verifymail').contents();
        var header = node.find('header');
        msg.signers.forEach(function(signer) {
          var type, userid;
          var message = $('<span/>');
          var keyid = $('<span/>');
          keyid.text('(' + l10n.dialog_keyid_label + ' ' + signer.keyid.toUpperCase() + ')');
          if (signer.userid) {
            userid = $('<strong/>');
            userid.text(signer.userid);
          }
          if (signer.userid && signer.valid) {
            type = 'success';
            message.append(l10n.verify_result_success, ' ', userid, ' ', keyid);
          } else if (!signer.userid) {
            type = 'warning';
            message.append(l10n.verify_result_warning, ' ', keyid);
          } else {
            type = 'danger';
            message.append(l10n.verify_result_error, ' ', userid, ' ', keyid);
          }
          header.showAlert('', message, type, true);
        });
        message = $.parseHTML(message);
        node.find('#content').append(message);
        break;
      case 'error-message':
        showErrorMsg(msg.error);
        break;
      default:
        console.log('unknown event');
    }
    clearTimeout(spinnerTimer);
    mvelo.util.hideLoadingAnimation();
  }

  $(document).ready(init);

}());
