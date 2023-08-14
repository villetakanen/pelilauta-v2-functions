/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */
import {initializeApp} from "firebase-admin/app";
import {setGlobalOptions} from "firebase-functions/v2/options";
import {onThreadCreated} from "./stream/onThreadCreated";
import {onThreadDeleted} from "./stream/onThreadDeleted";

initializeApp();
setGlobalOptions({region: "europe-west1"});

exports.onThreadCreated = onThreadCreated;
exports.onThreadDeleted = onThreadDeleted;

/*
interface InboxNotification {
  meta: {
    new: boolean;
  };
}
/*
exports.onNotification = onDocumentWritten(
  "inbox/{userId}", async (event) => {
    logger.info("onNotification called for: " + event.id);

    const messaging = getMessaging();
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) {
      throw new Error(
        "Trying to send notification for non-existing message");
    }

    if (before.read === after.read) {
      return Promise.resolve();
    }

    // Check if inbox has more unread messages than before
    const beforeCount = before.notifications.filter(
      (n: InboxNotification) => !n.meta.new).length;
    const afterCount = after.notifications.filter(
      (n: InboxNotification) => !n.meta.new).length;

    logger.info("Before: " + beforeCount + ", after: " + afterCount);

    // No new notifications, the user likely marked a notification as read
    if (beforeCount >= afterCount) {
      return Promise.resolve();
    }

    // Send the afterCount as a notification
    const subscription = await getFirestore().collection(
      "subscriptions").doc(event.id).get();

    const subData = subscription.data();

    // User has disabled push notifications
    if (!subscription.exists || !subData) {
      return Promise.resolve();
    }

    // Send the notification to all tokens of the user
    subData.messagingTokens.forEach((token: string) => {
      logger.info("Sending notification to token: " + token);
      messaging.send({
        token: token,
        notification: {
          title: "Pelilauta",
          body: "Uusia ilmoituksia (" + afterCount + ")",
        },
        data: {
          url: "https://pelilauta.web.app/inbox",
        },
      });
    });
  });
  */
