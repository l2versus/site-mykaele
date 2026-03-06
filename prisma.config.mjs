import { defineConfig } from 'prisma/config'

const DATABASE_URL = 'postgres://postgres:F2CnUQgJ36UmSz1lvuYHluw99hykrgsnBjehPaUgUkvc2LAhJxL4hLw0s7Ry5C8x@187.77.226.144:5432/postgres'

export default defineConfig({
    schema: 'prisma/schema.prisma',
    datasource: {
        url: DATABASE_URL,
    },
})