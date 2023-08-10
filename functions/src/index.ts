/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */
import * as logger from "firebase-functions/logger";
import {
  onDocumentCreated,
} from "firebase-functions/v2/firestore";
import {initializeApp} from "firebase-admin/app";
import {setGlobalOptions} from "firebase-functions/v2/options";
import {getFirestore} from "firebase-admin/firestore";
import {getMessaging} from "firebase-admin/messaging";

initializeApp();
setGlobalOptions({region: "europe-west1"});

exports.notifyOnThreadCreated = onDocumentCreated(
  "stream/{threadId}",
  async (event) => {
    const messaging = getMessaging();

    const subscribers = await getFirestore().collection("subscriptions").where(
      "notifyOnThreads", "==", true).get();

    const thread = event.data?.data();
    const threadId = event.data?.id;

    if (!thread) {
      throw new Error(
        "Trying to send notification for non-existing thread");
    }

    const author = await getFirestore().collection("profiles").doc(
      thread.author).get();
    const authorData = author.data();
    const nick = authorData?.nick || "Anonyymi";

    const title = thread.title || "Nimetön";
    const body = thread.topic ? nick + " loi uuden ketjun aiheessa " +
      thread.topic : nick + " loi uuden ketjun";

    subscribers.forEach((subscriber) => {
      logger.info("Sending notification to: " + subscriber.id);
      subscriber.data().messagingTokens.forEach((token: string) => {
        logger.info("Sending notification to token: " + token);
        messaging.send({
          token: token,
          notification: {
            title,
            body,
          },
          data: {
            threadId: threadId || "",
            url: `https://pelilauta.web.app/threads/${threadId}`,
          },
        });
      });
    });
    logger.info("Sent notifications for new thread: " + threadId);
    return Promise.resolve();
  });
