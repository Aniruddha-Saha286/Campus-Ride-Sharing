import React from "react";
import MyRides from "./MyRides.jsx";

export default function MyRidesPage() {
  return (
    <div className="w-full max-w-none px-6 py-10 lg:px-10">
      <div className="mx-auto w-full max-w-[1600px]">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">My Rides</h1>
          <p className="mt-1 text-sm text-slate-500">Rides you posted and seat requests you made.</p>
        </div>
        <MyRides />
      </div>
    </div>
  );
}
