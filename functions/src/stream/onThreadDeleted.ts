/**
 * These functions will be triggered when a new thread is created.
 *
 * 1. Update the stats in meta collection
 */
import {getFirestore} from "firebase-admin/firestore";
import {
  FirestoreEvent,
  QueryDocumentSnapshot,
  onDocumentDeleted,
} from "firebase-functions/v2/firestore";

import {metaStreamInfo} from "./onThreadCreated";

const FIRESTORE_PATH = "stream/{threadId}";

/**
 * Reduces the count of the topic in meta collection
 *
 * @param {FirestoreEvent<QueryDocumentSnapshot | undefined>} event
 *   the Firestore event
 */
async function updateStats(
  event: FirestoreEvent<QueryDocumentSnapshot | undefined>) {
  const topic = event.data?.data()?.topic || "Yleinen";

  const statsRef = getFirestore().collection("meta").doc("pelilauta");
  const stats = await statsRef.get();
  const topicArray:Array<metaStreamInfo> = stats.data()?.streams || [];

  // Find the index of the topic
  const topicIndex = topicArray.findIndex(
    (topicObject: metaStreamInfo) => topicObject.slug === topic);

  if (topicIndex > -1) {
    topicArray[topicIndex].count -= 1;
  }

  await statsRef.update({
    streams: topicArray,
  });
}

export const onThreadDeleted = onDocumentDeleted(
  FIRESTORE_PATH,
  async (event: FirestoreEvent<QueryDocumentSnapshot | undefined>) => {
    await updateStats(event);
  });
