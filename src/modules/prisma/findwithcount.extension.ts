import { Prisma } from "@prisma/client/extension";

export function findManyWithCountExtension(){
    return Prisma.defineExtension(client =>
        client.$extends({
            name: "find-many-with-count",
            model: {
                $allModels: {
                    findManyWithCount<Model, Args>(
                        this: Model,
                        args: Prisma.Exact<Args, Prisma.Args<Model, 'findMany'>>,
                    ): Promise<[Prisma.Result<Model, Args, 'findMany'>, number]> {
                        return client.$transaction([
                            (this as any).findMany(args),
                            (this as any).count({ where: (args as any).where }),
                        ]);
                    }
                }
            }
        })
    );
}