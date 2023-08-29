import {getFirestore} from "firebase-admin/firestore";
import {onDocumentCreated} from "firebase-functions/v2/firestore";

const FIRESTORE_PATH = "stream/{threadKey}/comments/{replyKey}";

/**
 * Updates the stats in the thread
 *
 * @param {string} threadKey the thread key
 */
async function updateStats(threadKey: string) {
  // ++ the reply count for the thread
  const threadRef = getFirestore().collection("stream").doc(threadKey);
  const thread = await threadRef.get();
  const count = thread.data()?.replyCount || 0;
  // Update the replyCount in db
  await threadRef.update({replyCount: count + 1});
}

/**
 * Sends a notification to the author of the thread
 *
 * @param {string} threadKey the thread key
 * @param {string} replyKey the reply key
 * @param {string} author the author of the reply
 * @param {string[]} owners the owners of the thread
 * @param {string} snippet the snippet of the reply
 */
async function notifyOnReplyToThreadCreated(
  threadKey: string,
  replyKey: string,
  author: string,
  owners: string[],
  snippet: string) {
  for (const owner of owners) {
    await getFirestore().collection("notifications").add({
      to: owner,
      from: author,
      message: snippet,
      targetKey: threadKey + "/" + replyKey,
      targetType: "reply.created",
      read: false,
    });
  }
}


export const onReplyToThreadCreated = onDocumentCreated(
  FIRESTORE_PATH,
  async (event) => {
    const replyKey = event.params?.replyKey;
    const threadKey = event.params?.threadKey;
    const author = event.data?.data()?.author || "";
    const snippet = event.data?.data()?.snippet || "";
    const threadDoc = await getFirestore().collection(
      "stream").doc(threadKey).get();
    const ownersData = threadDoc.data()?.owners || [];
    const owners = typeof ownersData === "string" ? [ownersData] : ownersData;

    await updateStats(threadKey);
    await notifyOnReplyToThreadCreated(
      threadKey,
      replyKey,
      author,
      owners,
      snippet
    );

    return Promise.resolve();
  }
);
