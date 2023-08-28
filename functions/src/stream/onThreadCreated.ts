/**
 * These functions will be triggered when a new thread is created.
 *
 * 1. Update the stats in meta collection
 * 2. Send notifications to all users who have subscribed new thread
 *    notifications (except the creator of the thread)
 *
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

const FIRESTORE_PATH = "stream/{threadId}";
const DEFAULT_TOPIC = "Yleinen";
const DEFAULT_ICON = "Adventurer";

setGlobalOptions({region: "europe-west1"});

export type metaStreamInfo = {
  slug: string,
  count: number,
  icon: string,
  description: string,
  order: number,
  name: string,
}

/**
 * Updates the stats in meta collection
 * @param {FirestoreEvent<QueryDocumentSnapshot |
 *   undefined, {threadId: string}>} event the Firestore event
 */
async function updateStats(
  event: FirestoreEvent<QueryDocumentSnapshot | undefined,
  {threadId: string}>) {
  const topic = event.data?.data()?.topic || DEFAULT_TOPIC;

  const statsRef = getFirestore().collection("meta").doc("pelilauta");


  const stats = await statsRef.get();

  const streams = stats.data()?.streams || {};

  // Find the index of the topic
  const stream:metaStreamInfo = streams[topic] || {
    slug: topic,
    count: 0,
    icon: DEFAULT_ICON,
    description: "",
    order: -1,
    name: topic,
  };

  // Update the count
  stream.count += 1;

  streams[topic] = stream;

  // Update the stats
  await statsRef.update({streams});
}

/**
 * Sends notifications to all users who have subscribed new thread
 * notifications (except the creator of the thread)
 * @param {FirestoreEvent<QueryDocumentSnapshot |
 *  undefined, {threadId: string}>} event the Firestore event
 */
async function notifyOnThreadCreated(
  event: FirestoreEvent<QueryDocumentSnapshot | undefined,
  {threadId: string}>) {
  const thread = event.data?.data();
  const threadId = event.data?.id;
  const messaging = getMessaging();

  const subscribers = await getFirestore().collection("subscriptions").where(
    "notifyOnThreads", "==", true).get();

  if (!subscribers || subscribers.empty) {
    logger.info("No subscribers found for new thread: " + threadId);
    return Promise.resolve();
  }

  if (!thread) {
    throw new Error(
      "Trying to send notification for non-existing thread");
  }

  const author = await getFirestore().collection("profiles").doc(
    thread.author).get();
  const authorData = author.data();
  const from = authorData?.nick || "Anonyymi";

  const title = thread.title || "Nimetön";
  const body = "thread.created";

  subscribers.forEach((subscriber) => {
    logger.info("Sending notification to: " + subscriber.id);
    if (subscriber.id === thread.author) {
      logger.info("Skipping notification to author themself: " + subscriber.id);
      return;
    }
    if (!subscriber.data().messagingTokens) {
      logger.info("Skipping notification to: " + subscriber.id +
        " as they have no messagingTokens");
      return;
    }
    subscriber.data().messagingTokens.forEach((token: string) => {
      logger.info("Sending notification to token: " + token);
      messaging.send({
        token: token,
        /* notification: {
          title,
          body,
        }, */
        data: {
          threadId: threadId || "",
          url: `https://pelilauta.web.app/threads/${threadId}`,
          icon: "https://pelilauta.web.app/proprietary/icons/dark/fox.svg",
          title,
          body,
          from,
        },
      });
    });
  });
  logger.info("Sent notifications for new thread: " + threadId);
  return Promise.resolve();
}


export const onThreadCreated = onDocumentCreated(
  FIRESTORE_PATH,
  async (event) => {
    await updateStats(event);
    await notifyOnThreadCreated(event);

    return Promise.resolve();
  }
);
