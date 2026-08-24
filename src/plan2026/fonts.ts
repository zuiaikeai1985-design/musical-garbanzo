import { loadFont as loadBrush } from "@remotion/google-fonts/MaShanZheng";
import { loadFont as loadSerif } from "@remotion/google-fonts/NotoSerifSC";
import { loadFont as loadTitle } from "@remotion/google-fonts/ZCOOLXiaoWei";

export const brush = loadBrush("normal", {
  weights: ["400"],
  subsets: ["latin", "chinese-simplified"],
  ignoreTooManyRequestsWarning: true,
});

export const serif = loadSerif("normal", {
  weights: ["300", "400", "600", "700"],
  subsets: ["latin", "chinese-simplified"],
  ignoreTooManyRequestsWarning: true,
});

export const title = loadTitle("normal", {
  weights: ["400"],
  subsets: ["latin", "chinese-simplified"],
  ignoreTooManyRequestsWarning: true,
});

export const brushFamily = brush.fontFamily;
export const serifFamily = serif.fontFamily;
export const titleFamily = title.fontFamily;

export const waitForPlanFonts = async () => {
  await Promise.all([
    brush.waitUntilDone(),
    serif.waitUntilDone(),
    title.waitUntilDone(),
  ]);
};
