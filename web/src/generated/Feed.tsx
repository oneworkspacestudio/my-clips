// Generated from screens/Feed.aui; edit the AUI source.
import { Button, Card, Heading, Icon, Link, Page, Row, Section, Spacer, Stack, Text } from "@/components/ui"

export function Feed({ data, onAction }: { data: any; onAction: (name: string) => void }) {
  return (
    <Page>
      <Row variant="feed-tabs">
        <Link href="#following" variant={data.followingClass}>Following</Link>
        <Link href="#friends" variant={data.friendsClass}>Friends</Link>
        <Link href="#home" variant={data.homeClass}>For You</Link>
        <Spacer />
        <Link href="#explore" variant="icon" aria-label="Search"><Icon name="Search" /></Link>
      </Row>
      {data.empty && (
        <Stack variant="empty-feed">
          <Icon name="Clapperboard" size={58} />
          <Text variant="eyebrow">MAKE THE FIRST MOVE</Text>
          <Heading level={1}>A little moment. A whole story.</Heading>
          <Text>Record something, add your sound, and make this space yours.</Text>
          <Button onClick={() => onAction("create")} variant="create">Create your first clip</Button>
          <Text variant="caption">Up to 3 minutes · Your videos stay on your server</Text>
        </Stack>
      )}
      <Stack variant="feed-scroll">
        {data.posts.map((item, i) => (
          <Card key={i} variant="video-card">
            <Section id="feed-player" item={item} />
            <Stack variant="video-caption">
              <Link href={item.profileURL} variant="creator">{item.handle}</Link>
              <Text>{item.caption}</Text>
              <Text variant="soundline">{item.soundLabel}</Text>
              <Text variant="reason">{item.reason}</Text>
            </Stack>
            <Stack variant="video-actions">
              <Button onClick={() => onAction("profile")} item={item.owner} variant="avatar" aria-label="View creator">{item.initials}</Button>
              <Button onClick={() => onAction("like")} item={item.id} variant={item.likeClass} aria-label="Like clip">
                <Icon name="Heart" size={29} />
                <Text>{item.likes}</Text>
              </Button>
              <Button onClick={() => onAction("comments")} item={item.id} variant="round-action" aria-label="Comments">
                <Icon name="MessageCircle" size={29} />
                <Text>{item.comments}</Text>
              </Button>
              <Button onClick={() => onAction("save")} item={item.id} variant={item.saveClass} aria-label="Save clip">
                <Icon name="Bookmark" size={27} />
                <Text>Save</Text>
              </Button>
              <Button onClick={() => onAction("share")} item={item.id} variant="round-action" aria-label="Share clip">
                <Icon name="Share2" size={27} />
                <Text>Share</Text>
              </Button>
              <Button onClick={() => onAction("more")} item={item.id} variant="round-action" aria-label="More options"><Icon name="Ellipsis" size={27} /></Button>
            </Stack>
          </Card>
        ))}
      </Stack>
      {data.hasPosts && (
        <Row variant="feed-hint">
          <Icon name="Mouse" size={16} />
          <Text>Scroll to explore</Text>
          <Text>↑ ↓</Text>
        </Row>
      )}
    </Page>
  )
}
