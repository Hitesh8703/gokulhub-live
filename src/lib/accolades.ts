import {
  doc,
  updateDoc,
  getDoc,
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

export const accolades = [

  {
    id: "clean_starter",
    title: "🗑 Clean Starter",
    description: "Dispose garbage 3 times",
    xp: 25,
    rarity: "Common",
    condition: (r: any) => (r.garbageCount || 0) >= 3,
  },

  {
    id: "first_speaker",
    title: "💬 First Speaker",
    description: "Send first chat message",
    xp: 25,
    rarity: "Common",
    condition: (r: any) => (r.messageCount || 0) >= 1,
  },

  {
    id: "three_day_streak",
    title: "🔥 3-Day Streak",
    description: "Maintain 3-day streak",
    xp: 30,
    rarity: "Common",
    condition: (r: any) => (r.streak || 0) >= 3,
  },

  {
    id: "settled_resident",
    title: "🏠 Settled Resident",
    description: "Reach Level 2",
    xp: 25,
    rarity: "Common",
    condition: (r: any) => (r.level || 1) >= 2,
  },

  {
    id: "active_neighbor",
    title: "👋 Active Neighbor",
    description: "Log in for 5 total days",
    xp: 40,
    rarity: "Common",
    condition: (r: any) => (r.streak || 0) >= 5,
  },

  {
    id: "weekly_visitor",
    title: "📅 Weekly Visitor",
    description: "Use app for 7 days",
    xp: 40,
    rarity: "Common",
    condition: (r: any) => (r.streak || 0) >= 7,
  },

  {
    id: "eco_saver",
    title: "🌱 Eco Saver",
    description: "Dispose garbage 15 times",
    xp: 75,
    rarity: "Uncommon",
    condition: (r: any) => (r.garbageCount || 0) >= 15,
  },

  {
    id: "quiet_resident",
    title: "🤫 Quiet Resident",
    description: "No complaints for 7 days",
    xp: 80,
    rarity: "Uncommon",
    condition: (r: any) =>
      (r.complaintCount || 0) === 0 &&
      (r.streak || 0) >= 7,
  },

  {
    id: "xp_grinder",
    title: "⚡ XP Grinder",
    description: "Reach 500 XP",
    xp: 100,
    rarity: "Uncommon",
    condition: (r: any) => (r.xp || 0) >= 500,
  },

  {
    id: "community_voice",
    title: "💭 Community Voice",
    description: "Send 50 chat messages",
    xp: 75,
    rarity: "Uncommon",
    condition: (r: any) => (r.messageCount || 0) >= 50,
  },

  {
    id: "cleanliness_warrior",
    title: "🧹 Cleanliness Warrior",
    description: "15-day streak",
    xp: 100,
    rarity: "Uncommon",
    condition: (r: any) => (r.streak || 0) >= 15,
  },

  {
    id: "responsible_resident",
    title: "🏡 Responsible Resident",
    description: "No admin warnings for 14 days",
    xp: 90,
    rarity: "Uncommon",
    condition: (r: any) =>
      (r.complaintCount || 0) === 0 &&
      (r.streak || 0) >= 14,
  },

  {
    id: "peacekeeper",
    title: "🛡 Peacekeeper",
    description: "No complaints for 30 days",
    xp: 150,
    rarity: "Rare",
    condition: (r: any) =>
      (r.complaintCount || 0) === 0 &&
      (r.streak || 0) >= 30,
  },

  {
    id: "top_resident",
    title: "🏆 Top Resident",
    description: "Reach Top 3 leaderboard",
    xp: 200,
    rarity: "Rare",
    condition: (r: any) => r.isTopResident || false,
  },

  {
    id: "veteran_resident",
    title: "📈 Veteran Resident",
    description: "Reach Level 10",
    xp: 175,
    rarity: "Rare",
    condition: (r: any) => (r.level || 1) >= 10,
  },

  {
    id: "xp_hunter",
    title: "🚀 XP Hunter",
    description: "Reach 1500 XP",
    xp: 200,
    rarity: "Rare",
    condition: (r: any) => (r.xp || 0) >= 1500,
  },

  {
    id: "community_pillar",
    title: "🗨 Community Pillar",
    description: "30-day login streak",
    xp: 175,
    rarity: "Rare",
    condition: (r: any) => (r.streak || 0) >= 30,
  },

  {
    id: "complaint_free_month",
    title: "⚙ Complaint-Free Month",
    description: "Zero complaints for 30 days",
    xp: 200,
    rarity: "Rare",
    condition: (r: any) =>
      (r.complaintCount || 0) === 0 &&
      (r.streak || 0) >= 30,
  },

  {
    id: "apartment_champion",
    title: "👑 Apartment Champion",
    description: "Reach Rank #1 once",
    xp: 350,
    rarity: "Epic",
    condition: (r: any) => r.isTopResident || false,
  },

  {
    id: "elite_resident",
    title: "💎 Elite Resident",
    description: "Reach Level 25",
    xp: 400,
    rarity: "Epic",
    condition: (r: any) => (r.level || 1) >= 25,
  },

  {
    id: "streak_god",
    title: "🔥 Streak God",
    description: "60-day streak",
    xp: 450,
    rarity: "Epic",
    condition: (r: any) => (r.streak || 0) >= 60,
  },

  {
    id: "untouchable",
    title: "🎯 Untouchable",
    description: "Reach 2500 XP with under 3 complaints",
    xp: 500,
    rarity: "Epic",
    condition: (r: any) =>
      (r.xp || 0) >= 2500 &&
      (r.complaintCount || 0) < 3,
  },

  {
    id: "society_titan",
    title: "⚔ Society Titan",
    description: "Top leaderboard 5 weeks in a row",
    xp: 550,
    rarity: "Epic",
    condition: () => false,
  },

  {
    id: "hall_of_fame",
    title: "🏛 Hall of Fame",
    description: "Reach Level 50",
    xp: 1000,
    rarity: "Legendary",
    condition: (r: any) => (r.level || 1) >= 50,
  },

  {
    id: "gokul_legend",
    title: "🌟 Gokul Legend",
    description: "90 days complaint-free + Level 35",
    xp: 1200,
    rarity: "Legendary",
    condition: (r: any) =>
      (r.level || 1) >= 35 &&
      (r.complaintCount || 0) === 0 &&
      (r.streak || 0) >= 90,
  },

  {
    id: "founder_resident",
    title: "👑 Founder Resident",
    description: "Joined during beta testing phase",
    xp: 1500,
    rarity: "Legendary",
    condition: () => false,
  },

];

export async function checkAccolades(
  userId: string,
  residentData: any
) {

  const residentRef = doc(db, "residents", userId);

  const residentSnap = await getDoc(residentRef);

  if (!residentSnap.exists()) return;

  const currentData = residentSnap.data();

  const unlockedAccolades =
    currentData.unlockedAccolades || [];

  let updatedXP =
    currentData.xp || 0;

  const newUnlocked = [...unlockedAccolades];

  for (const accolade of accolades) {

    const alreadyUnlocked =
      unlockedAccolades.includes(accolade.id);

    if (
      !alreadyUnlocked &&
      accolade.condition(currentData)
    ) {

      newUnlocked.push(accolade.id);

      updatedXP += accolade.xp;

      await addDoc(
        collection(db, "notifications"),
        {
          type: "private",
          targetApartment:
            currentData.apartmentNumber,
          title: "🏅 Accolade Unlocked",
          description:
            `You unlocked ${accolade.title}`,
          createdAt: serverTimestamp(),
        }
      );
    }
  }

  const updatedLevel =
    Math.floor(updatedXP / 200) + 1;

  await updateDoc(residentRef, {
    unlockedAccolades: newUnlocked,
    xp: updatedXP,
    level: updatedLevel,
  });
}