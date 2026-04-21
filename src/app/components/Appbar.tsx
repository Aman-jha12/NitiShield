"use client";
import { Session } from "next-auth";

import { signIn,signOut, useSession } from "next-auth/react";

export default function Appbar() {
  const session = useSession();
  
  return (
    <div className="w-full h-16 bg-gray-800 text-white flex items-center justify-between px-4">
      <div className="text-lg font-bold">My Blog WIth Auth</div>
      <div>
        {session?.data?.user && <span className="mr-4">Welcome, {session.data.user.name}</span>}
        {!session?.data?.user && <button onClick={() => signIn()} className="px-4 py-2 bg-blue-500 rounded hover:bg-blue-600">Signin</button>}
        {session?.data?.user && <button onClick={() => signOut()} className="ml-2 px-4 py-2 bg-gray-500 rounded hover:bg-gray-600">Logout</button>}
      </div>
    </div>
  );
}