import {prisma} from "@/lib/prisma";
import { NextResponse } from "next/server";
import zod from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

