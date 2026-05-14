import { createRouter } from "@tanstack/react-router";

// Import the generated route tree
import { routeTree } from "./routeTree.gen";
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient();

// Create a new router instance
export const getRouter = () => {
  return createRouter({
    routeTree,
    context: {
      queryClient,
    },
    defaultPreload: "viewport",
    defaultViewTransition: {
      types: ({ fromLocation, toLocation }) => {
        let direction = "none";
        if (fromLocation) {
          const fromIndex = fromLocation.state.__TSR_index;
          const toIndex = toLocation.state.__TSR_index;
          direction = fromIndex > toIndex ? "right" : "left";
          if (fromLocation.pathname.includes(toLocation.pathname)) {
            direction = "right";
          }
        }

        return [`slide-${direction}`];
      },
    },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });
};
