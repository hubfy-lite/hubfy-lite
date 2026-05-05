import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface Changelog3Props {
  className?: string;
}

const Changelog3 = ({ className }: Changelog3Props) => {
  return (
    <section className={cn("py-32", className)}>
      <div className="container">
        <div className="space-y-10">
          <article className="relative mx-auto flex max-w-3xl flex-col gap-6 md:flex-row md:gap-10">
            <time className="h-fit text-sm font-semibold text-muted-foreground md:sticky md:top-10">
              February 11, 2025
            </time>
            <div>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-amber-400"></span>
                  <p className="text-sm font-semibold text-primary/80">
                    Maintenance
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-purple-500"></span>
                  <p className="text-sm font-semibold text-primary/80">
                    Documentation
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-blue-500"></span>
                  <p className="text-sm font-semibold text-primary/80">
                    Feature
                  </p>
                </div>
              </div>
              <div className="prose mt-6 dark:prose-invert">
                <h2>New dashboard and analytics</h2>
                <p>
                  We've added a new dashboard and analytics to help you track
                  your usage.
                  <br />
                  As with all of our
                  <a href="#" className="mx-1 underline">
                    integrations
                  </a>
                  , we do the heavy lifting for you. It’s easy to set up,
                  privacy-focused, performant, and secure. We also handle cookie
                  consent where required, in a very intuitive way.
                  <br />
                  <br />
                  For example, we handle cookie consent where required, in a way
                  that is both intuitive and easy to understand. Also, we handle
                  the cookie consent banner, so you don't have to.
                  <br />
                  <br />
                  For more information, please refer to the
                  <a href="#" className="mx-1 underline">
                    documentation
                  </a>
                  .
                </p>
                <img
                  src="https://deifkwefumgah.cloudfront.net/shadcnblocks/block/placeholder-1.svg"
                  alt="placeholder"
                  className="my-4 aspect-video rounded-lg border border-border object-cover"
                />
              </div>
            </div>
          </article>
          <Separator />
          <article className="relative mx-auto flex max-w-3xl flex-col gap-6 md:flex-row md:gap-10">
            <time className="h-fit text-sm font-semibold text-muted-foreground md:sticky md:top-10">
              January 28, 2025
            </time>
            <div>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-amber-400"></span>
                  <p className="text-sm font-semibold text-primary/80">
                    Maintenance
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-purple-500"></span>
                  <p className="text-sm font-semibold text-primary/80">
                    Documentation
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-red-500"></span>
                  <p className="text-sm font-semibold text-primary/80">
                    Security
                  </p>
                </div>
              </div>
              <div className="prose mt-6 dark:prose-invert">
                <h2>Enhanced Security Features</h2>
                <p>
                  We&apos;ve strengthened our security infrastructure to provide
                  even better protection for your data. As with all of our
                  <a href="#" className="mx-1 underline">
                    security features
                  </a>
                  , we do the heavy lifting for you. It&apos;s easy to set up,
                  fully encrypted, SOC 2 compliant, and continuously monitored.
                  We also handle threat detection where required, in a very
                  comprehensive way.
                  <br />
                  <br />
                  We implement real-time threat monitoring, automated incident
                  response, and advanced encryption protocols. Also, we handle
                  all security certifications and compliance requirements, so
                  you don&apos;t have to.
                  <br />
                  <br />
                  For more information, please refer to our
                  <a href="#" className="mx-1 underline">
                    security documentation
                  </a>
                  .
                </p>
                <img
                  src="https://deifkwefumgah.cloudfront.net/shadcnblocks/block/placeholder-2.svg"
                  alt="placeholder"
                  className="my-4 aspect-video rounded-lg border border-border object-cover"
                />
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
};

export { Changelog3 };
