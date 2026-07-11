import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { subscribeLoading, isLoading } from "../store/loadingStore";

// Avoid flicker on fast requests: only show after a short delay, and once
// shown, keep it up for a minimum stretch so it doesn't blink on/off.
const SHOW_DELAY_MS = 150;
const MIN_VISIBLE_MS = 400;

const GlobalLoadingBar = () => {
  const [visible, setVisible] = useState(false);
  const showTimer = useRef(null);
  const hideTimer = useRef(null);
  const shownAt = useRef(0);

  useEffect(() => {
    const clearTimers = () => {
      clearTimeout(showTimer.current);
      clearTimeout(hideTimer.current);
    };

    const unsubscribe = subscribeLoading((count) => {
      clearTimers();

      if (count > 0) {
        showTimer.current = setTimeout(() => {
          shownAt.current = Date.now();
          setVisible(true);
        }, SHOW_DELAY_MS);
      } else {
        const elapsed = Date.now() - shownAt.current;
        const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);
        hideTimer.current = setTimeout(() => setVisible(false), remaining);
      }
    });

    if (isLoading()) setVisible(true);

    return () => {
      clearTimers();
      unsubscribe();
    };
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed top-0 left-0 right-0 z-[200] h-[3px] overflow-hidden bg-black/40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="h-full w-1/3 rounded-full bg-gradient-to-r from-yellow-400 via-amber-300 to-purple-500 shadow-[0_0_12px_rgba(250,204,21,0.7)]"
            animate={{ x: ["-100%", "220%"] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default GlobalLoadingBar;
