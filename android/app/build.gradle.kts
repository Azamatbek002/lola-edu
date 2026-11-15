// Lola Edu — Android ilova (Trusted Web Activity).
// Ilova lola-edu.vercel.app saytini to'liq ekranda ochadi: ma'lumotlar Supabase serverida,
// yangilanishlar saytdan keladi — Play Market'ga qayta yuklash faqat ikonka/nom/versiya o'zgarganda kerak.
//
// Imzolash (kalit repozitoriyga QO'YILMAYDI):
//   LOLA_KEYSTORE=/yo'l/lola-upload.jks LOLA_KEYSTORE_PASSWORD=... ./gradlew bundleRelease
plugins {
    id("com.android.application")
}

val keystorePath: String? = System.getenv("LOLA_KEYSTORE")

android {
    namespace = "uz.lolaedu.app"
    compileSdk = 36

    defaultConfig {
        applicationId = "uz.lolaedu.app"
        minSdk = 24
        targetSdk = 36
        versionCode = (project.findProperty("versionCode") as String?)?.toInt() ?: 1
        versionName = (project.findProperty("versionName") as String?) ?: "1.0.0"
    }

    signingConfigs {
        create("release") {
            if (keystorePath != null) {
                storeFile = file(keystorePath)
                storePassword = System.getenv("LOLA_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("LOLA_KEY_ALIAS") ?: "upload"
                keyPassword = System.getenv("LOLA_KEY_PASSWORD") ?: System.getenv("LOLA_KEYSTORE_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            if (keystorePath != null) signingConfig = signingConfigs.getByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation("com.google.androidbrowserhelper:androidbrowserhelper:2.7.4")
}
