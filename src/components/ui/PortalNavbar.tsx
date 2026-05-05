import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, MotionConfig } from "framer-motion";

export type IMenu = {
  id: number;
  title: string;
  url: string;
  dropdown?: boolean;
  items?: IMenu[];
};

type PortalNavbarProps = {
  list: IMenu[];
  selectedId?: number;
};

const baseItemClass =
  "relative flex items-center justify-center rounded px-6 py-3 text-sm font-medium text-white/90 transition-all hover:bg-white/10 hover:text-white";

const PortalNavbar = ({ list, selectedId }: PortalNavbarProps) => {
  const [hovered, setHovered] = useState<number | null>(null);
  const activeId = hovered ?? selectedId ?? null;

  return (
    <MotionConfig transition={{ bounce: 0, type: "tween" }}>
      <nav className="relative">
        <ul className="flex items-center gap-1">
          {list?.map((item) => {
            const isPlaceholder = item.url === "#";
            const isActive = activeId === item.id;

            return (
              <li key={item.id} className="relative">
                {isPlaceholder ? (
                  <a
                    href={item.url}
                    className={`${baseItemClass} ${isActive ? "bg-white/10 text-white" : ""}`}
                    onClick={(e) => e.preventDefault()}
                    onMouseEnter={() => setHovered(item.id)}
                    onMouseLeave={() => setHovered(null)}
                  >
                    {item.title}
                  </a>
                ) : (
                  <Link
                    className={`${baseItemClass} ${isActive ? "bg-white/10 text-white" : ""}`}
                    onMouseEnter={() => setHovered(item.id)}
                    onMouseLeave={() => setHovered(null)}
                    to={item.url}
                  >
                    {item.title}
                  </Link>
                )}

                {isActive && !item.dropdown && (
                  <motion.div
                    layout
                    layoutId="cursor"
                    className="absolute h-0.5 w-full bg-white"
                  />
                )}

                {item.dropdown && hovered === item.id && (
                  <div
                    className="absolute left-0 top-full z-20"
                    onMouseEnter={() => setHovered(item.id)}
                    onMouseLeave={() => setHovered(null)}
                  >
                    <motion.div
                      layout
                      transition={{ bounce: 0 }}
                      initial={{ y: 10 }}
                      animate={{ y: 0 }}
                      exit={{ y: 10 }}
                      className="mt-4 flex w-64 flex-col rounded border border-white/15 bg-neutral-900/95"
                      layoutId="cursor"
                    >
                      {item.items?.map((nav) => (
                        <a
                          key={`link-${nav.id}`}
                          href={nav.url}
                          className="w-full p-4 text-sm text-white/90 hover:bg-white/10"
                        >
                          {nav.title}
                        </a>
                      ))}
                    </motion.div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </MotionConfig>
  );
};

export default PortalNavbar;
