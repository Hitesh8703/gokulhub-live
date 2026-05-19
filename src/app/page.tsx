"use client";

import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6">
      <h1 className="text-6xl font-bold mb-4">
        Welcome to GokulHub
      </h1>

      <p className="text-gray-400 mb-10 text-xl">
        Gamified Apartment Community Platform
      </p>

      <Link href="/login">
        <button className="bg-green-500 hover:bg-green-600 px-10 py-4 rounded-2xl text-2xl font-bold">
          Enter GokulHub
        </button>
      </Link>
    </main>
  );
}