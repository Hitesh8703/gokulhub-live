const admin = require("firebase-admin");

const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const DEFAULT_PASSWORD = "Gokul123";

const apartments = [

  "001",
  "002",

  "101",
  "102",
  "103",
  "104",

  "201",
  "202",
  "204",

  "301",
  "302",
  "303",
  "304",

  "401",
  "402",
  "403",
  "404",

  "501",
  "502",
  "503",
  "504",

  "601",
  "602",
  "603",
  "604",

  "701",
  "702",
  "703",
  "704",

  "801",
  "802",
  "803",
  "804",

  "901",
  "902",
  "903",
  "904",
];

async function createResidents() {

  for (const apartment of apartments) {

    try {

      const email =
        `${apartment}@gokulhub.com`;

      const userRecord =
        await admin.auth().createUser({
          email,
          password: DEFAULT_PASSWORD,
        });

      await db
        .collection("residents")
        .doc(userRecord.uid)
        .set({

          apartmentNumber:
            apartment,

          xp: 0,

          level: 1,

          streak: 0,

          garbageCount: 0,

          messageCount: 0,

          unlockedAccolades: [],

          createdAt:
            new Date().toISOString(),
        });

      console.log(
        `✅ Created apartment ${apartment}`
      );

    } catch (error) {

      console.log(
        `❌ Error for apartment ${apartment}`,
        error.message
      );
    }
  }

  console.log(
    "🎉 Finished creating residents"
  );
}

createResidents();