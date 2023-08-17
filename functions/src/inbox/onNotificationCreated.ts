/**
 * These functions will be triggered when a new notification is created.
 *
 * 1. Check if the 'to' field is a valid user, who has
 *    subscribed to notifications
 * 2. Send the notification to the user
 *
 * A Notification entry format is roughly:
 * {
 *   createdAt: admin.firestore.FieldValue.serverTimestamp(),
 *   to: reply.author,
 *   from: context.params.uid,
 *   message: 'notification.reply.loved',
 *   targetKey: threadKey + '/' + replyKey,
 *   targetType: 'reply.loved',
 *   read: false,
 * })
 */
import {getFirestore} from "firebase-admin/firestore";
import {getMessaging} from "firebase-admin/messaging";
import {
  FirestoreEvent,
  QueryDocumentSnapshot,
  onDocumentCreated,
} from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import {setGlobalOptions} from "firebase-functions/v2/options";

const FIRESTORE_PATH = "notification/{notificationId}";

setGlobalOptions({region: "europe-west1"});

/**
 * Sends a notification to the user if they have subscribed to notifications
 *
 * @param {FirestoreEvent<QueryDocumentSnapshot |
 *   undefined,{notificationId: string}>} event the Firestore event
 */
async function notifyOnCreated(
  event: FirestoreEvent<QueryDocumentSnapshot | undefined,
  {notificationId: string}>) {
  const notification = event.data?.data();
  const messageRecipientUid = notification?.to || "";

  const db = getFirestore();
  const messaging = getMessaging();

  const subscription = await db.collection(
    "subscriptions").doc(messageRecipientUid).get();

  if (!subscription.exists) {
    logger.info("No subscription for " + messageRecipientUid);
    return;
  }

  const subscriptionData = subscription.data();

  if (!subscriptionData) {
    logger.info("No subscription data for " + messageRecipientUid);
    return;
  }

  if (subscriptionData.notifyOnLikes) {
    const title = "Uusi reaktio";
    const fromDoc = await db.collection(
      "profiles").doc(notification?.from).get();
    const from = fromDoc.data()?.nick || "Anonyymi";
    const target = notification?.targetType.split(
      ".")[0] === "reply" ? "vastauksen" : "sivuston";
    const body = `${from} merkitsi ${target}`;

    const tokens = subscriptionData.messagingTokens || [];
    tokens.forEach((token: string) => {
      messaging.send({
        token: token,
        /* notification: {
          title,
          body,
        }, */
        data: {
          url: "https://pelilauta.web.app/inbox",
          icon: "https://pelilauta.web.app/proprietary/icons/dark/send.svg",
          title,
          body,
        },
      });
    });
  }
}


export const onNotificationCreated = onDocumentCreated(
  FIRESTORE_PATH,
  async (event) => {
    await notifyOnCreated(event);

    return Promise.resolve();
  }
);

