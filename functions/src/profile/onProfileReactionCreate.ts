/**
 * Logic triggered by a Firestore create of
 *   'profiles/{uid}/reactions/{reactionKey}'
 *
 * Notifications are added to the queue for the user who created the reaction
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

import {DocumentData, getFirestore, FieldValue} from "firebase-admin/firestore";
import {logger} from "firebase-functions/v1";
import {onDocumentCreated} from "firebase-functions/v2/firestore";
import {setGlobalOptions} from "firebase-functions/v2/options";

const FIRESTORE_PATH = "profiles/{uid}/reactions/{reactionKey}";

setGlobalOptions({region: "europe-west1"});

/**
 * Creates a notification of a like to the owners of the site.
 *
 * Please note: a push-notification is created by onNotificationCreate.ts
 * if a user has subscribed to notifications for reactions.
 *
 * @param {DocumentData} data the reaction data
 * @param {string} from the uid that created the reaction
 * @param {string[]} to the uids of the site owners
 */
async function createSiteNotification(
  data: DocumentData, from: string, to: string[]) {
  logger.info("Creating site notification for " + data.targetKey);

  const db = getFirestore();
  const notification = {
    createdAt: FieldValue.serverTimestamp(),
    to: "",
    from: from,
    message: "notification.site.loved",
    targetKey: data.targetKey,
    targetType: "site.loved",
    read: false,
  };

  for (const owner of to) {
    notification.to = owner;
    await db.collection("profiles").doc(owner).collection(
      "notifications").add(notification);
  }
}

/**
 * Adds a site to profile's favorites
 *
 * @param {string} sitekey the site key
 * @param {string} uid the uid of the user
 */
async function addSiteToFavorites(sitekey: string, uid: string) {
  logger.info("Adding site to favorites for " + uid);

  const db = getFirestore();
  const profileDoc = await db.collection("profiles").doc(uid).get();

  if (!profileDoc.exists) {
    throw new Error(
      "Profile does not exist, or an invalid profile key was provided");
  }

  const profile = profileDoc.data();

  if (profile === undefined) {
    throw new Error(
      "Profile data is undefined, this is likely a bug in Firestore");
  }

  const lovedSites = profile.lovedSites || [];
  if (lovedSites.includes(sitekey)) {
    logger.info("Site already in favorites");
    return;
  }

  lovedSites.push(sitekey);
  await db.collection("profiles").doc(uid).update({lovedSites});
}

/**
 * Removes a site from profile's favorites
 *
 * @param {string} sitekey the site key
 * @param {string} uid the uid of the user
 */
async function removeSiteFromFavorites(sitekey: string, uid: string) {
  logger.info("Removing site from favorites for " + uid);

  const db = getFirestore();
  const profileDoc = await db.collection("profiles").doc(uid).get();

  if (!profileDoc.exists) {
    throw new Error(
      "Profile does not exist, or an invalid profile key was provided");
  }

  const profile = profileDoc.data();

  if (profile === undefined) {
    throw new Error(
      "Profile data is undefined, this is likely a bug in Firestore");
  }

  const lovedSites = profile.lovedSites || [];
  if (!lovedSites.includes(sitekey)) {
    logger.info("Site not in favorites");
    return;
  }

  const index = lovedSites.indexOf(sitekey);
  lovedSites.splice(index, 1);

  await db.collection("profiles").doc(uid).update({lovedSites});
}

/**
 * Handles a reaction targeting a site
 *
 * @param {DocumentData} data the reaction data
 * @param {string} from the uid that created the reaction
 */
async function handleSiteReaction(data: DocumentData, from: string) {
  logger.info("Handling site reaction for " + data.targetKey);

  const db = getFirestore();
  const siteKey = data.targetKey;

  const siteDoc = await db.collection("sites").doc(siteKey).get();
  if (!siteDoc.exists) {
    throw new Error(
      "Site does not exist, or an invalid site key was provided");
  }

  const site = siteDoc.data();
  if (site === undefined) {
    throw new Error(
      "Site data is undefined, this is likely a bug in Firestore");
  }

  if (data.type === "love") {
    await db.collection("sites").doc(siteKey).update({
      lovesCount: FieldValue.increment(1),
    });
    await addSiteToFavorites(siteKey, from);
    const owners = Array.isArray(site.owners) ? site.owners : [site.owners];

    await createSiteNotification(data, from, owners);
  } else if (data.type === "unlove") {
    if (site.lovesCount === 0) {
      throw new Error(
        "Site loves count is 0, this is likely an error in the database");
    }
    await db.collection("sites").doc(siteKey).update({
      lovesCount: FieldValue.increment(-1),
    });
    await removeSiteFromFavorites(siteKey, from);
  }
}

/**
 * Handles a reaction targeting a reply
 *
 * @param {DocumentData} data the reaction data
 * @param {string} from the uid that created the reaction
 */
async function handleReplyReaction(data: DocumentData, from: string) {
  logger.info("Handling reply reaction for " + data.targetKey);

  const db = getFirestore();
  const [threadKey, replyKey] = data.targetKey.split("/");

  const replyDoc = await db.collection(
    "stream").doc(threadKey).collection("comments").doc(replyKey).get();

  if (!replyDoc.exists) {
    throw new Error(
      "Reply does not exist, or an invalid reply key was provided");
  }

  const reply = replyDoc.data();
  if (reply === undefined) {
    throw new Error(
      "Reply data is undefined, this is likely a bug in Firestore");
  }

  db.collection("notifications").add({
    createdAt: FieldValue.serverTimestamp(),
    to: reply.author,
    from: from,
    message: "notification.reply.loved",
    targetKey: threadKey + "/" + replyKey,
    targetType: "reply.loved",
    read: false,
  });
}

export const onProfileReactionCreate = onDocumentCreated(
  FIRESTORE_PATH,
  async (event) => {
    const data = event.data?.data();
    const from = event.params?.uid;

    // Sanity checks
    if (data === undefined) {
      throw new Error(
        "Reaction data is undefined, this is likely a bug in Firestore");
    }
    if (data.targetEntry === undefined) {
      throw new Error(
        "Reaction target entry is undefined, this is likely a bug in Client");
    }
    if (data.type === undefined) {
      throw new Error(
        "Reaction target type is undefined, this is likely a bug in Client");
    }

    if (data.targetEntry === "sites") handleSiteReaction(data, from);
    else if (data.targetEntry === "comments") handleReplyReaction(data, from);
    else {
      throw new Error(
        "Invalid target entry provided, this is likely a bug in Client " +
        data.targetEntry + " " + data.type);
    }

    return Promise.resolve();
  }
);
