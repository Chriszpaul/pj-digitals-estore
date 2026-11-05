import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Text from './AppText';
import { type Palette } from '../data/catalog';
import { useStoreTheme } from '../ThemeContext';

export type ProductReview = { id: string; name: string; rating: number; comment: string; date: string };


export default function ProductReviews({ reviews, onSubmit }: { reviews: ProductReview[]; onSubmit: (review: ProductReview) => void }) {
  const { palette: colors } = useStoreTheme();
  const styles = createStyles(colors);
  const [rating, setRating] = useState(0);
  const [name, setName] = useState('');
  const [comment, setComment] = useState('');
  const [message, setMessage] = useState('');
  const average = reviews.length ? (reviews.reduce((total, review) => total + review.rating, 0) / reviews.length).toFixed(1) : null;

  function submit() {
    if (!rating || !name.trim() || !comment.trim()) { setMessage('Choose a star rating and enter your name and review.'); return; }
    onSubmit({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, name: name.trim(), rating, comment: comment.trim(), date: new Date().toLocaleDateString('en-IN') });
    setRating(0); setComment(''); setMessage('Thank you! Your review has been added.');
  }

  return <View style={styles.section}>
    <View style={styles.heading}><Text style={styles.title}>Customer reviews</Text><Text style={styles.summary}>{average ? `★ ${average} · ${reviews.length} reviews` : 'No reviews yet'}</Text></View>
    {!reviews.length ? <Text style={styles.hint}>Be the first to share your experience with this item.</Text> : null}
    {reviews.map((review) => <View key={review.id} style={styles.review}>
      <View style={styles.heading}><Text style={styles.name}>{review.name}</Text><Text style={styles.date}>{review.date}</Text></View>
      <Text style={styles.rating} accessibilityLabel={`${review.rating} out of 5 stars`}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</Text>
      <Text style={styles.comment}>{review.comment}</Text>
    </View>)}
    <View style={styles.form}>
      <Text style={styles.formTitle}>Write a review</Text>
      <Text style={styles.hint}>Your rating</Text>
      <View style={styles.stars}>{[1, 2, 3, 4, 5].map((value) => <Pressable key={value} onPress={() => { setRating(value); setMessage(''); }} accessibilityRole="button" accessibilityLabel={`Rate ${value} out of 5 stars`} accessibilityState={{ selected: rating === value }} style={styles.starButton}><Text style={[styles.star, value <= rating && styles.selectedStar]}>{value <= rating ? '★' : '☆'}</Text></Pressable>)}</View>
      <Text style={styles.label}>YOUR NAME</Text>
      <TextInput value={name} onChangeText={setName} placeholder="Your name" accessibilityLabel="Reviewer name" placeholderTextColor={colors.muted} maxLength={60} style={styles.input} autoCapitalize="words" />
      <Text style={styles.label}>YOUR REVIEW</Text>
      <TextInput value={comment} onChangeText={setComment} placeholder="What did you like about this item?" accessibilityLabel="Product review" placeholderTextColor={colors.muted} maxLength={1000} multiline style={[styles.input, styles.textarea]} />
      <Pressable onPress={submit} accessibilityRole="button" style={styles.submit}><Text style={styles.submitText}>Submit review</Text></Pressable>
      {message ? <Text style={styles.feedback} accessibilityLiveRegion="polite">{message}</Text> : null}
      <Text style={styles.note}>Reviews are saved for this app session.</Text>
    </View>
  </View>;
}

const createStyles = (colors: Palette) => StyleSheet.create({
  section: { marginTop: 28, paddingTop: 20, borderTopWidth: 1, borderTopColor: colors.border }, heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }, title: { fontSize: 19, fontWeight: '800', color: colors.text }, summary: { fontSize: 11, color: colors.gold, fontWeight: '800' }, hint: { fontSize: 12, lineHeight: 18, color: colors.muted, marginTop: 8 },
  review: { padding: 15, borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.surface, marginTop: 12 }, name: { color: colors.text, fontSize: 13, fontWeight: '800' }, date: { color: colors.muted, fontSize: 10 }, rating: { color: colors.gold, marginTop: 7, fontSize: 17 }, comment: { color: colors.text, marginTop: 8, fontSize: 12, lineHeight: 19 },
  form: { padding: 18, marginTop: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, formTitle: { color: colors.text, fontSize: 16, fontWeight: '800' }, stars: { flexDirection: 'row', marginTop: 4 }, starButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, star: { fontSize: 30, color: colors.muted }, selectedStar: { color: colors.gold },
  label: { color: colors.gold, fontSize: 9, fontWeight: '800', letterSpacing: 1, marginTop: 12, marginBottom: 7 }, input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, minHeight: 45, color: colors.text, fontSize: 12 }, textarea: { minHeight: 95, textAlignVertical: 'top' }, submit: { backgroundColor: colors.primary, minHeight: 45, alignItems: 'center', justifyContent: 'center', borderRadius: 10, marginTop: 15 }, submitText: { color: colors.onPrimary, fontSize: 12, fontWeight: '800' }, feedback: { color: colors.primaryText, fontSize: 12, lineHeight: 18, marginTop: 10 }, note: { color: colors.muted, fontSize: 10, marginTop: 10 },
});
