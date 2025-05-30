import { NextResponse } from "next/server";
import { aiCategorizeSendersSchema } from "@/app/api/user/categorize/senders/batch/handle-batch-validation";
import { getThreadsFromSenderWithSubject } from "@/utils/gmail/thread";
import {
  categorizeWithAi,
  getCategories,
  updateSenderCategory,
} from "@/utils/categorize/senders/categorize";
import { isActionError } from "@/utils/error";
import { validateUserAndAiAccess } from "@/utils/user/validate";
import { getGmailClientWithRefresh } from "@/utils/gmail/client";
import { UNKNOWN_CATEGORY } from "@/utils/ai/categorize-sender/ai-categorize-senders";
import { createScopedLogger } from "@/utils/logger";
import prisma from "@/utils/prisma";
import { saveCategorizationProgress } from "@/utils/redis/categorization-progress";

const logger = createScopedLogger("api/user/categorize/senders/batch");

export async function handleBatchRequest(
  request: Request,
): Promise<NextResponse> {
  try {
    const handleBatchResult = await handleBatchInternal(request);
    if (isActionError(handleBatchResult))
      return NextResponse.json({ error: handleBatchResult.error });
    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error("Handle batch request error", { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

async function handleBatchInternal(request: Request) {
  const json = await request.json();
  const body = aiCategorizeSendersSchema.parse(json);
  const { email, senders } = body;

  logger.trace("Handle batch request", { email, senders: senders.length });

  const userResult = await validateUserAndAiAccess({ email });
  if (isActionError(userResult)) return userResult;
  const { emailAccount } = userResult;

  const categoriesResult = await getCategories(emailAccount.userId);
  if (isActionError(categoriesResult)) return categoriesResult;
  const { categories } = categoriesResult;

  const emailAccountWithAccount = await prisma.emailAccount.findUnique({
    where: { email },
    select: {
      account: {
        select: {
          access_token: true,
          refresh_token: true,
          expires_at: true,
          providerAccountId: true,
        },
      },
    },
  });

  const account = emailAccountWithAccount?.account;

  if (!account) return { error: "No account found" };
  if (!account.access_token || !account.refresh_token)
    return { error: "No access or refresh token" };

  const gmail = await getGmailClientWithRefresh(
    {
      accessToken: account.access_token,
      refreshToken: account.refresh_token,
      expiryDate: account.expires_at,
    },
    account.providerAccountId,
  );
  if (!gmail) return { error: "No Gmail client" };

  const sendersWithEmails: Map<string, { subject: string; snippet: string }[]> =
    new Map();

  // 1. fetch 3 messages for each sender
  for (const sender of senders) {
    const threadsFromSender = await getThreadsFromSenderWithSubject(
      gmail,
      account.access_token,
      sender,
      3,
    );
    sendersWithEmails.set(sender, threadsFromSender);
  }

  // 2. categorize senders with ai
  const results = await categorizeWithAi({
    user: emailAccount,
    sendersWithEmails,
    categories,
  });

  // 3. save categorized senders to db
  for (const result of results) {
    await updateSenderCategory({
      sender: result.sender,
      categories,
      categoryName: result.category ?? UNKNOWN_CATEGORY,
      userId: emailAccount.userId,
    });
  }

  // // 4. categorize senders that were not categorized
  // const uncategorizedSenders = results.filter(isUncategorized);

  // await saveCategorizationProgress({
  //   userId,
  //   incrementCompleted: senders.length - uncategorizedSenders.length,
  // });

  // for (const sender of uncategorizedSenders) {
  //   try {
  //     await categorizeSender(sender.sender, user, gmail, categories);
  //   } catch (error) {
  //     logger.error("Error categorizing sender", {
  //       sender: sender.sender,
  //       error,
  //     });
  //     captureException(error);
  //   }

  //   await saveCategorizationProgress({
  //     userId,
  //     incrementCompleted: 1,
  //   });
  // }

  await saveCategorizationProgress({
    email,
    incrementCompleted: senders.length,
  });

  return NextResponse.json({ ok: true });
}

// const isUncategorized = (r: { category?: string }) =>
//   !r.category ||
//   r.category === UNKNOWN_CATEGORY ||
//   r.category === REQUEST_MORE_INFORMATION_CATEGORY;
