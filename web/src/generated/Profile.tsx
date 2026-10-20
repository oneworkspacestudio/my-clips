// Generated from screens/Profile.aui; edit the AUI source.
import { Badge, Button, Card, Grid, Heading, Icon, Image, Link, Page, Row, Spacer, Stack, Text } from "@/components/ui"

export function Profile({ data, onAction }: { data: any; onAction: (name: string) => void }) {
  return (
    <Page>
      <Stack variant="standard-page">
        <Row variant="profile-heading">
          <Text variant="profile-avatar">{data.initials}</Text>
          <Stack>
            <Heading level={1}>{data.handle}</Heading>
            <Text>{data.name}</Text>
            <Row>
              <Text>{data.followingText}</Text>
              <Text>{data.followersText}</Text>
              <Text>{data.postsText}</Text>
            </Row>
            <Text>{data.bio}</Text>
          </Stack>
          <Spacer />
          {data.own ? (
            <Link href="#settings" variant="button">Edit profile</Link>
          ) : (
            <>
              <Button onClick={() => onAction("follow")} item={data.profileID} variant="create">{data.followLabel}</Button>
              <Button onClick={() => onAction("message")} item={data.profileID} variant="secondary">Message</Button>
              <Button onClick={() => onAction("block")} item={data.profileID} variant="icon" aria-label="Block account"><Icon name="ShieldBan" /></Button>
            </>
          )}
        </Row>
        <Row variant="tabs">
          <Text>Videos</Text>
          {data.own && (
            <>
              <Link href="#saved">Saved</Link>
              <Link href="#studio">Studio</Link>
              <Button onClick={() => onAction("restoreDraft")} variant="secondary">Open device draft</Button>
            </>
          )}
        </Row>
        <Grid columns={3} variant="clip-grid">
          {data.posts.map((item, i) => (
            <Card key={i} variant="clip-tile">
              <Link href={item.href}>
                <Image src={item.poster} alt={item.caption} />
                <Text>{item.caption}</Text>
                <Badge>{item.state}</Badge>
              </Link>
            </Card>
          ))}
        </Grid>
        {data.empty && (
          <Stack variant="empty">
            <Icon name="Video" size={38} />
            <Heading level={2}>Your moments belong here</Heading>
            <Text>Published clips appear on this profile.</Text>
          </Stack>
        )}
      </Stack>
    </Page>
  )
}
