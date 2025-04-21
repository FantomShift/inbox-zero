import React from "react";
import Image from "next/image";
import Link from "next/link";
import { env } from "@/env";
import { Button } from "@/components/ui/button";
import { SparklesIcon } from "@/components/icons/SparklesIcon";

export function TryInboxZero() {
  return (
    <Link
      href={`${env.NEXT_PUBLIC_BASE_URL}/?utm_source=blog&utm_medium=inbox-zero`}
    >
      <div className="rounded-lg border-2 border-blue-400 bg-white shadow-xl transition-transform duration-300 hover:scale-105">
        <Image
          src="/images/reach-inbox-zero.png"
          alt="UIP Control"
          width={1200}
          height={800}
          className="mt-6 rounded-lg border"
        />
        <p className="p-4 text-gray-700">
          Let AI handle your emails, unsubscribe from newsletters, and block
          unwanted messages.
        </p>
        <div className="px-4 pb-4">
          <Button className="w-full" variant="blue">
            Try UIP Control
          </Button>
        </div>
      </div>
    </Link>
  );
}
