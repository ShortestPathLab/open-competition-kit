import { MeTabs } from "@/components/me-tabs";
import { PageHeaderBand } from "@/components/page-header-band";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Link } from "@tanstack/react-router";
import { Fragment, type ReactNode } from "react";

/** One step between "Your competitions" and the page you are on. */
export type MeCrumb = {
  label: string;
  section: "enrolments" | "submissions" | "settings";
};

const SECTION_ROUTES = {
  enrolments: "/me/enrolments",
  submissions: "/me/submissions",
  settings: "/me/settings",
} as const;

interface MePageHeaderProps {
  title: ReactNode;
  /** The bold final breadcrumb. Defaults to `title` when that is a string. */
  crumb?: string;
  /** Steps between the personal area and this page. Usually zero or one. */
  trail?: MeCrumb[];
  description?: ReactNode;
  /** Right-aligned controls. Header buttons are `size="lg"` with `h-10 px-5`. */
  actions?: ReactNode;
  meta?: ReactNode;
  /** Leading visual, left of the title block. */
  media?: ReactNode;
  /**
   * Whether to carry the personal-area tabs under the breadcrumb.
   *
   * On for the four sections, off for anything below them, on the same argument
   * the competition pages make: a submission is somewhere you went *to*, and a
   * tab strip there offers to move you sideways out of what you were reading.
   * The breadcrumb is what takes you back out.
   */
  tabs?: boolean;
  className?: string;
}

/**
 * The header band for a page in the reader's own area.
 *
 * The same construction as `CompetitionPageHeader`, one level up: the area is
 * named in the breadcrumb and the title belongs to the page. The band used to
 * live in the `/me` layout, which meant every page under it opened with "Your
 * competitions" and only then got around to saying which page you were on.
 */
export function MePageHeader({
  title,
  crumb,
  trail = [],
  description,
  actions,
  meta,
  media,
  tabs = false,
  className,
}: MePageHeaderProps) {
  const current = crumb ?? (typeof title === "string" ? title : undefined);

  return (
    <PageHeaderBand
      className={className}
      title={title}
      description={description}
      actions={actions}
      meta={meta}
      media={media}
      breadcrumb={
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink render={<Link to="/me" />}>
                Your competitions
              </BreadcrumbLink>
            </BreadcrumbItem>
            {trail.map((step) => (
              <Fragment key={step.section}>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink
                    render={<Link to={SECTION_ROUTES[step.section]} />}
                  >
                    {step.label}
                  </BreadcrumbLink>
                </BreadcrumbItem>
              </Fragment>
            ))}
            {current ?
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{current}</BreadcrumbPage>
                </BreadcrumbItem>
              </>
            : null}
          </BreadcrumbList>
        </Breadcrumb>
      }
      nav={tabs ? <MeTabs /> : undefined}
    />
  );
}
