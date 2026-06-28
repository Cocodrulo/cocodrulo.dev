export interface ContributionDay {
    date: string
    count: number
    level: 0 | 1 | 2 | 3 | 4
}

export interface ContributionWeek {
    contributionDays: ContributionDay[]
}

export interface GHPullRequest {
    title: string
    url: string
    number: number
    state: 'OPEN' | 'CLOSED' | 'MERGED'
    createdAt: string
    updatedAt: string
    comments: { totalCount: number }
    repository: { nameWithOwner: string }
    labels: { nodes: Array<{ name: string; color: string }> }
}

export interface GHRepo {
    name: string
    description: string | null
    url: string
    stargazerCount: number
    forkCount: number
    primaryLanguage: { name: string; color: string } | null
    visibility: string
}
