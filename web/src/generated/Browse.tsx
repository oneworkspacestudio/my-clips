// Generated from screens/Browse.aui; edit the AUI source.
import { Button, Card, Grid, Heading, Icon, Image, Input, Link, Page, Row, Spacer, Stack, Text } from "@/components/ui"

export function Browse({ data, onAction }: { data: any; onAction: (name: string) => void }) {
  return (
    <Page>
      <Stack variant="standard-page">
        <Text variant="eyebrow">FIND YOUR NEXT FAVORITE</Text>
        <Heading level={1}>{data.title}</Heading>
        <Row variant="searchbox">
          <Icon name="Search" />
          <Input name="query" placeholder="Clips, creators, hashtags" onClick={() => onAction("doSearch")} />
          <Button onClick={() => onAction("doSearch")} variant="secondary">Search</Button>
        </Row>
        {data.empty && (
          <Text variant="empty">No results yet. Try a different search or post the first clip.</Text>
        )}
        <Grid columns={3} variant="clip-grid">
          {data.posts.map((item, i) => (
            <Card key={i} variant="clip-tile">
              <Link href={item.href}>
                <Image src={item.poster} alt={item.caption} />
                <Text>{item.caption}</Text>
                <Text variant="caption">{item.handle}</Text>
              </Link>
            </Card>
          ))}
        </Grid>
        <Stack>
          {data.people.map((item, i) => (
            <Row key={i} variant="person">
              <Link href={item.href} variant="avatar">{item.initials}</Link>
              <Stack>
                <Link href={item.href}>{item.handle}</Link>
                <Text variant="caption">{item.bio}</Text>
              </Stack>
              <Spacer />
              <Button onClick={() => onAction("follow")} item={item.id} variant="secondary">{item.followLabel}</Button>
            </Row>
          ))}
        </Stack>
      </Stack>
    </Page>
  )
}
