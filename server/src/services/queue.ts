import PQueue from "p-queue";

export const generationQueue = new PQueue({ concurrency: 3 });
