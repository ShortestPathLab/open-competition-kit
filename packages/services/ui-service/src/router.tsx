import { createRouter } from "@tanstack/react-router";

// Import the generated route tree
import { routeTree } from "./routeTree.gen";
import { QueryClient } from "@tanstack/react-query";
import { ErrorPage } from "@/components/error-page";
import { NotFoundPage } from "@/components/not-found-page";

export const queryClient = new QueryClient();

// Create a new router instance
export const getRouter = () => {
  return createRouter({
    routeTree,
    context: {
      queryClient,
    },
    // Every route gets these unless it names its own. `defaultErrorComponent`
    // catches what loaders, `beforeLoad` guards and renders throw;
    // `defaultNotFoundComponent` catches `notFound()` and, at the root, a URL
    // that matches no route at all.
    defaultErrorComponent: ErrorPage,
    defaultNotFoundComponent: NotFoundPage,
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
